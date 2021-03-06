/* @flow */
import DeviceInfo from 'react-native-device-info';

import type { GetState, Dispatch, Action } from '../types';
import config from '../config';
import { allPrivateNarrow } from '../utils/narrow';
import { tryUntilSuccessful } from '../utils/async';
import { getMessages, getStreams, getUsers, registerForEvents } from '../api';
import { refreshNotificationToken, initializeNotifications } from '../utils/notifications';
import { messageFetchSuccess, switchNarrow } from '../message/messagesActions';
import { initStreams } from '../streams/streamsActions';
import { initUsers, sendFocusPing } from '../users/usersActions';
import { getAuth, getActiveNarrow, getPushToken } from '../selectors';
import { trySendMessages } from '../outbox/outboxActions';
import { startEventPolling } from '../events/eventActions';

import {
  REALM_INIT,
  INITIAL_FETCH_COMPLETE,
  SAVE_TOKEN_PUSH,
  DELETE_TOKEN_PUSH,
} from '../actionConstants';

export const realmInit = (data: Object): Action => ({
  type: REALM_INIT,
  data,
});
export const initialFetchComplete = (): Action => ({
  type: INITIAL_FETCH_COMPLETE,
});

export const deleteTokenPush = (): Action => ({
  type: DELETE_TOKEN_PUSH,
});

const saveTokenPush = (pushToken: string) => ({
  type: SAVE_TOKEN_PUSH,
  pushToken,
});

export const initNotifications = (): Action => (dispatch: Dispatch, getState: GetState) => {
  initializeNotifications(
    getAuth(getState()),
    token => dispatch(saveTokenPush(token)),
    switchNarrow,
  );
};

export const fetchEssentialInitialData = (): Action => async (
  dispatch: Dispatch,
  getState: GetState,
) => {
  const auth = getAuth(getState());
  const narrow = getActiveNarrow(getState());
  const halfCount = Math.trunc(config.messagesPerRequest / 2);

  const [initData, messages] = await Promise.all([
    await tryUntilSuccessful(() => registerForEvents(auth)),
    await tryUntilSuccessful(() => getMessages(auth, 0, halfCount, halfCount, narrow, true)),
  ]);

  dispatch(realmInit(initData));
  dispatch(messageFetchSuccess(messages, narrow, 0, halfCount, halfCount, true));
  dispatch(initialFetchComplete());

  dispatch(startEventPolling(initData.queue_id, initData.last_event_id));
};

export const fetchRestOfInitialData = (): Action => async (
  dispatch: Dispatch,
  getState: GetState,
) => {
  const auth = getAuth(getState());
  const pushToken = getPushToken(getState());
  const [messages, streams, users] = await Promise.all([
    await tryUntilSuccessful(() =>
      getMessages(auth, Number.MAX_SAFE_INTEGER, 100, 0, allPrivateNarrow),
    ),
    await tryUntilSuccessful(() => getStreams(auth)),
    await tryUntilSuccessful(() => getUsers(auth)),
  ]);
  dispatch(messageFetchSuccess(messages, allPrivateNarrow, 0, 0, 0, true));
  dispatch(initStreams(streams));
  dispatch(initUsers(users));

  if (auth.apiKey !== '' && pushToken === '') {
    refreshNotificationToken();
  }
  dispatch(trySendMessages());
};

export const doInitialFetch = (): Action => async (dispatch: Dispatch, getState: GetState) => {
  dispatch(fetchEssentialInitialData());
  dispatch(fetchRestOfInitialData());

  if (!DeviceInfo.isEmulator()) {
    dispatch(initNotifications());
  }
  dispatch(sendFocusPing());
  setInterval(() => sendFocusPing(), 60 * 1000);
};
