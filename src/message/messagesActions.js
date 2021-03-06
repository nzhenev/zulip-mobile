/* @flow */
import type { Action, Narrow, Dispatch, GetState } from '../types';
import { getMessages } from '../api';
import { registerAppActivity } from '../utils/activity';
import {
  getAuth,
  getUsers,
  getAllMessages,
  getFirstMessageId,
  getLastMessageId,
  getCaughtUpForActiveNarrow,
} from '../selectors';
import config from '../config';
import {
  SWITCH_NARROW,
  MESSAGE_FETCH_START,
  MESSAGE_FETCH_SUCCESS,
  MARK_MESSAGES_READ,
} from '../actionConstants';
import { getMessageIdFromLink, getNarrowFromLink, isUrlInAppLink, getFullUrl } from '../utils/url';
import openLink from '../utils/openLink';

export const switchNarrow = (narrow: Narrow): Action => ({
  type: SWITCH_NARROW,
  narrow,
});

export const messageFetchStart = (
  narrow: Narrow,
  fetchingOlder: boolean,
  fetchingNewer: boolean,
): Action => ({
  type: MESSAGE_FETCH_START,
  narrow,
  fetchingOlder,
  fetchingNewer,
});

export const messageFetchSuccess = (
  messages: any[],
  narrow: Narrow,
  anchor: number,
  numBefore: number,
  numAfter: number,
  replaceExisting: boolean = false,
): Action => ({
  type: MESSAGE_FETCH_SUCCESS,
  messages,
  narrow,
  anchor,
  numBefore,
  numAfter,
  replaceExisting,
});

export const backgroundFetchMessages = (
  anchor: number,
  numBefore: number,
  numAfter: number,
  narrow: Narrow,
  useFirstUnread: boolean = false,
): Action => async (dispatch: Dispatch, getState: GetState) => {
  const messages = await getMessages(
    getAuth(getState()),
    anchor,
    numBefore,
    numAfter,
    narrow,
    useFirstUnread,
  );

  dispatch(messageFetchSuccess(messages, narrow, anchor, numBefore, numAfter));
};

export const fetchMessages = (
  anchor: number,
  numBefore: number,
  numAfter: number,
  narrow: Narrow,
  useFirstUnread: boolean = false,
): Action => async (dispatch: Dispatch) => {
  dispatch(messageFetchStart(narrow, numBefore > 0, numAfter > 0));
  dispatch(backgroundFetchMessages(anchor, numBefore, numAfter, narrow, useFirstUnread));
};

export const fetchMessagesAtFirstUnread = (narrow: Narrow): Action =>
  fetchMessages(0, config.messagesPerRequest / 2, config.messagesPerRequest / 2, narrow, true);

export const markMessagesRead = (messageIds: number[]): Action => ({
  type: MARK_MESSAGES_READ,
  messageIds,
});

export const fetchOlder = () => (dispatch: Dispatch, getState: GetState): Action => {
  const state = getState();
  const firstMessageId = getFirstMessageId(state);
  const caughtUp = getCaughtUpForActiveNarrow(state);
  const { fetchingOlder, narrow } = state.chat;
  const { needsInitialFetch } = state.app;

  if (!needsInitialFetch && !fetchingOlder && !caughtUp.older && firstMessageId) {
    dispatch(fetchMessages(firstMessageId, config.messagesPerRequest, 0, narrow));
  }
};

export const fetchNewer = () => (dispatch: Dispatch, getState: GetState): Action => {
  const state = getState();
  const lastMessageId = getLastMessageId(state);
  const caughtUp = getCaughtUpForActiveNarrow(state);
  const { fetchingNewer, narrow } = state.chat;
  const { needsInitialFetch } = state.app;

  if (!needsInitialFetch && !fetchingNewer && !caughtUp.newer && lastMessageId) {
    dispatch(fetchMessages(lastMessageId, 0, config.messagesPerRequest, narrow));
  }
};

export const doNarrow = (newNarrow: Narrow, anchor: number = Number.MAX_SAFE_INTEGER): Action => (
  dispatch: Dispatch,
  getState: GetState,
) => {
  const auth = getAuth(getState());
  const anyMessagesInNewNarrow = JSON.stringify(newNarrow) in getAllMessages(getState());
  const caughtUp = getCaughtUpForActiveNarrow(getState());

  if (!anyMessagesInNewNarrow && !caughtUp.newer && !caughtUp.older) {
    dispatch(fetchMessagesAtFirstUnread(newNarrow));
  }
  registerAppActivity(auth);
  dispatch(switchNarrow(newNarrow));
};

export const messageLinkPress = (href: string) => (dispatch: Dispatch, getState: GetState) => {
  const state = getState();
  const auth = getAuth(state);

  if (isUrlInAppLink(href, auth.realm)) {
    const users = getUsers(state);
    const anchor = getMessageIdFromLink(href, auth.realm);
    const narrow = getNarrowFromLink(href, auth.realm, users);

    dispatch(doNarrow(narrow, anchor));
  } else {
    openLink(getFullUrl(href, auth.realm));
  }
};
