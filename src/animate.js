// @flow
import React from 'react';
import propsGenerator from './utils/propsGenerator';
import filterMountOrUnmount from './utils/filterMountOrUnmount';
import mapChildren from './utils/mapChildren';
import setDelayState from './utils/setDelayState';

export const defaultState = {
  willEnd: false,
  willStart: false,
  willComplete: false,
  willEnter: false,
  willLeave: false,
  played: false,
  childrenStoreInState: [],
};

export type Style = { [string]: string | number };

type ChildrenType = Array<React$Element<any>> | React$Element<any> | null;

export type Props = {
  startAnimation: boolean,
  children?: ChildrenType,
  startStyle?: Style,
  endStyle: Style,
  onCompleteStyle?: Style,
  durationSeconds?: number,
  delaySeconds?: number,
  reverseDelaySeconds?: number,
  easeType?: string,
  forceUpdate?: boolean,
  tag?: string,
  onComplete?: () => mixed,
  onError?: (Object, Object) => mixed,
  className?: string,
  animateOnAddRemove: boolean,
  render: Object => any,
  transition?: string,
  refCallback?: (React$Element<any>) => {},
};

export type State = {
  willEnd: boolean,
  willStart: boolean,
  willComplete: boolean,
  willEnter: boolean,
  willLeave: boolean,
  played: boolean,
  childrenStoreInState?: ChildrenType,
};

const timeDelayForChildEnterOrLeave = 0.005;

export default class Animate extends React.Component<Props, State> {
  static displayName = 'ReactSimpleAnimate';

  static defaultProps = {
    startStyle: {},
    onCompleteStyle: undefined,
    durationSeconds: 0.3,
    delaySeconds: 0,
    children: null,
    reverseDelaySeconds: 0,
    easeType: 'linear',
    forceUpdate: false,
    tag: 'div',
    onComplete: undefined,
    onError: undefined,
    className: undefined,
    transition: '',
    refCallback: undefined,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      ...defaultState,
      ...(props.children ? { childrenStoreInState: props.children } : null),
    };
  }

  componentDidMount() {
    this.setDelayAndOnComplete(this.props);
  }

  componentWillReceiveProps(nextProps: Props) {
    const { startAnimation, children } = nextProps;
    const toggledAnimation = startAnimation !== this.props.startAnimation;

    this.setState({
      ...(toggledAnimation ? { ...{ ...defaultState } } : null),
      childrenStoreInState: children,
      played: toggledAnimation,
    });
  }

  shouldComponentUpdate(
    { startStyle, endStyle, startAnimation, children, forceUpdate }: Props,
    { willEnd, willStart, willComplete, willLeave, willEnter }: State,
  ) {
    // only situation that should trigger a re-render
    return (
      // object compare can be enahnced, but try to keep it simple here
      JSON.stringify(startStyle) !== JSON.stringify(this.props.startStyle) ||
      JSON.stringify(endStyle) !== JSON.stringify(this.props.endStyle) ||
      startAnimation !== this.props.startAnimation ||
      children !== this.props.children ||
      willEnd !== this.state.willEnd ||
      willStart !== this.state.willStart ||
      willComplete !== this.state.willComplete ||
      willLeave !== this.state.willLeave ||
      willEnter !== this.state.willEnter ||
      !!forceUpdate
    );
  }

  componentDidUpdate(previousProps: Props) {
    const { reverseDelaySeconds, animateOnAddRemove, startAnimation } = this.props;
    const toggledAnimation = startAnimation !== previousProps.startAnimation;
    // animation on mount or unmount
    if (animateOnAddRemove) this.setChildrenState(this.props);

    this.setDelayAndOnComplete(this.props, toggledAnimation && !startAnimation && !!reverseDelaySeconds);
  }

  componentDidCatch(error: Object, info: Object) {
    const { onError = false } = this.props;
    if (onError) onError(error, info);
  }

  componentWillUnmount() {
    this.delayTimeout && clearTimeout(this.delayTimeout);
    this.completeTimeout && clearTimeout(this.completeTimeout);
    this.leaveTimeout && clearTimeout(this.leaveTimeout);
    this.enterTimeout && clearTimeout(this.enterTimeout);
    this.delayTimeout = undefined;
    this.completeTimeout = undefined;
    this.leaveTimeout = undefined;
    this.enterTimeout = undefined;
  }

  setDelayAndOnComplete(
    { delaySeconds, startAnimation, onCompleteStyle, durationSeconds, onComplete, reverseDelaySeconds }: Props,
    isReverseWithDelay: boolean = false,
  ): void {
    // delay animation
    this.delayTimeout && clearTimeout(this.delayTimeout);

    if (delaySeconds && startAnimation) {
      this.delayTimeout = setDelayState.call(this, delaySeconds, 'willEnd');
    } else if (isReverseWithDelay) {
      // reverse animation
      this.delayTimeout = setDelayState.call(this, reverseDelaySeconds, 'willStart');
    }

    if ((!onComplete && !onCompleteStyle) || !startAnimation) return;

    this.completeTimeout && clearTimeout(this.completeTimeout);
    this.completeTimeout = setDelayState.call(
      this,
      parseFloat(delaySeconds) || parseFloat(durationSeconds) || 0,
      'willComplete',
      onComplete,
    );
  }

  setCurrentChildrenToState = () => {
    this.setState({
      childrenStoreInState: this.props.children,
    });
  };

  setChildrenState(nextProps: Props): void {
    const { childrenStoreInState } = this.state;
    const { children, startAnimation, durationSeconds } = nextProps;

    if (!Array.isArray(childrenStoreInState) || !Array.isArray(children) || !startAnimation) {
      return;
    }

    if (childrenStoreInState.length !== children.length) {
      const { mappedChildren, childrenWillUnmount, childrenWillMount } = filterMountOrUnmount(
        childrenStoreInState,
        children,
      );

      if (childrenWillUnmount && startAnimation) {
        this.leaveTimeout && clearTimeout(this.leaveTimeout);
        this.leaveTimeout = setDelayState.call(this, durationSeconds, 'willLeave', this.setCurrentChildrenToState);
      }

      this.setState({
        willEnter: false,
        willLeave: false,
        childrenStoreInState: mappedChildren,
      });

      if (childrenWillMount && startAnimation) {
        this.enterTimeout && clearTimeout(this.enterTimeout);
        this.enterTimeout = setDelayState.call(this, timeDelayForChildEnterOrLeave, 'willEnter', this.setCurrentChildrenToState);
      }
    } else if (!startAnimation) {
      this.enterTimeout && clearTimeout(this.enterTimeout);
      this.enterTimeout = setDelayState.call(this, timeDelayForChildEnterOrLeave, 'willEnter', this.setCurrentChildrenToState);

      this.setState({
        childrenStoreInState,
      });
    }
  }

  delayTimeout = null;
  completeTimeout = null;
  leaveTimeout = null;
  enterTimeout = null;

  render() {
    const { tag, children, animateOnAddRemove, render } = this.props;
    const tagName = tag || 'div';
    const componentProps = propsGenerator(this.props, this.state);
    const haveChildToAnimate = Array.isArray(children) && animateOnAddRemove;

    if (render && !haveChildToAnimate) {
      return render(componentProps);
    }
    return React.createElement(
      tagName,
      componentProps,
      haveChildToAnimate ? mapChildren(this.props, this.state) : children,
    );
  }
}
