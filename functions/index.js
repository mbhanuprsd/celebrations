const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { AccessToken, TrackSource } = require('livekit-server-sdk');
const { defineSecret, defineString } = require('firebase-functions/params');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

initializeApp();

const livekitApiKey = defineSecret('LIVEKIT_API_KEY');
const livekitApiSecret = defineSecret('LIVEKIT_API_SECRET');
const livekitUrl = defineString('LIVEKIT_URL');

exports.createVoiceRoomToken = onCall({
  region: 'europe-west3',
  secrets: [livekitApiKey, livekitApiSecret],
}, async request => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'Sign in before joining voice chat.');
  }

  const roomId = request.data?.roomId;
  if (typeof roomId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(roomId)) {
    throw new HttpsError('invalid-argument', 'A valid game room ID is required.');
  }

  const snapshot = await getFirestore().collection('rooms').doc(roomId).get();
  const game = snapshot.data();
  if (!snapshot.exists || !game?.players?.[userId] || game.status !== 'playing') {
    throw new HttpsError('permission-denied', 'You must be a player in an active game to join voice chat.');
  }

  const url = livekitUrl.value();
  if (!/^wss:\/\//i.test(url)) {
    throw new HttpsError('failed-precondition', 'LiveKit must be configured with a secure WebSocket URL.');
  }

  const voiceRoom = `celebrations-${roomId}`;
  const token = new AccessToken(livekitApiKey.value(), livekitApiSecret.value(), {
    identity: userId,
    ttl: '1h',
  });
  token.addGrant({
    roomJoin: true,
    room: voiceRoom,
    canSubscribe: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
  });

  return { url, token: await token.toJwt() };
});
