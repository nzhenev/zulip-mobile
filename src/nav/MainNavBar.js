/* @flow */
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { View } from 'react-native';

import type { Actions } from '../types';
import boundActions from '../boundActions';
import Title from '../title/Title';
import NavButton from './NavButton';
import {
  getUnreadPmsTotal,
  getUnreadHuddlesTotal,
  getUnreadMentionsTotal,
  getTitleBackgroundColor,
  getTitleTextColor,
} from '../selectors';

class MainNavBar extends PureComponent {
  static contextTypes = {
    styles: () => null,
  };

  props: {
    actions: Actions,
    backgroundColor: string,
    textColor: string,
    editMessage: boolean,
    unreadHuddlesTotal: number,
    unreadMentionsTotal: number,
    unreadPmsTotal: number,
    onPressPeople: () => void,
    onPressStreams: () => void,
  };

  render() {
    const { styles } = this.context;
    const {
      actions,
      backgroundColor,
      textColor,
      unreadPmsTotal,
      unreadHuddlesTotal,
      unreadMentionsTotal,
      onPressStreams,
      onPressPeople,
      editMessage,
    } = this.props;

    const leftPress = editMessage ? actions.cancelEditMessage : onPressStreams;

    return (
      <View style={[styles.navBar, { backgroundColor }]}>
        <NavButton
          name={editMessage ? 'md-arrow-back' : 'ios-menu'}
          color={textColor}
          showCircle={unreadMentionsTotal > 0}
          onPress={leftPress}
        />
        <Title color={textColor} />
        {!editMessage &&
          <NavButton
            name="md-people"
            color={textColor}
            borderRadius={20}
            unreadCount={unreadPmsTotal + unreadHuddlesTotal}
            onPress={onPressPeople}
          />}
      </View>
    );
  }
}

export default connect(
  state => ({
    backgroundColor: getTitleBackgroundColor(state),
    textColor: getTitleTextColor(state),
    unreadHuddlesTotal: getUnreadHuddlesTotal(state),
    unreadMentionsTotal: getUnreadMentionsTotal(state),
    unreadPmsTotal: getUnreadPmsTotal(state),
    editMessage: state.app.editMessage,
  }),
  boundActions,
)(MainNavBar);
