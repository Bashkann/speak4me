import { useCallback, useEffect, useState } from 'react';
import {
  ConnectionState,
  Participant,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from 'livekit-client';
import { getVoiceToken } from '../api/rooms';

export type MicrophoneState = 'off' | 'starting' | 'on' | 'muted' | 'denied';

interface LiveKitAudioState {
  connectionState: ConnectionState;
  microphoneState: MicrophoneState;
  microphoneError: string | null;
  playbackBlocked: boolean;
  audioLevels: Record<string, number>;
  microphoneEnabled: Record<string, boolean>;
  toggleMicrophone: () => Promise<void>;
  resumeAudio: () => Promise<void>;
}

interface UseLiveKitAudioInput {
  roomId?: string;
  enabled: boolean;
  shouldPublish: boolean;
}

export function useLiveKitAudio({ roomId, enabled, shouldPublish }: UseLiveKitAudioInput): LiveKitAudioState {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState(ConnectionState.Disconnected);
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>('off');
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>({});
  const [microphoneEnabled, setMicrophoneEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!enabled || !roomId) return;
    let disposed = false;
    const livekitRoom = new Room({ adaptiveStream: true, dynacast: true });
    const audioRoot = document.createElement('div');
    audioRoot.hidden = true;
    audioRoot.dataset.livekitAudio = roomId;
    document.body.append(audioRoot);

    const updateMicrophones = () => {
      const participants: Participant[] = [livekitRoom.localParticipant, ...livekitRoom.remoteParticipants.values()];
      setMicrophoneEnabled(Object.fromEntries(participants.map((participant) => {
        const publication = participant.getTrackPublication(Track.Source.Microphone);
        return [participant.identity, Boolean(publication && !publication.isMuted)];
      })));
    };
    const attachAudio = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const element = track.attach();
      element.dataset.trackSid = track.sid;
      audioRoot.append(element);
    };
    const detachAudio = (track: RemoteTrack) => {
      track.detach().forEach((element) => element.remove());
    };
    const updateLevels = (speakers: Participant[]) => {
      setAudioLevels(Object.fromEntries(speakers.map((participant) => [participant.identity, participant.audioLevel])));
    };
    const updatePlayback = () => setPlaybackBlocked(!livekitRoom.canPlaybackAudio);

    livekitRoom.on(RoomEvent.ConnectionStateChanged, setConnectionState);
    livekitRoom.on(RoomEvent.TrackSubscribed, attachAudio);
    livekitRoom.on(RoomEvent.TrackUnsubscribed, detachAudio);
    livekitRoom.on(RoomEvent.ActiveSpeakersChanged, updateLevels);
    livekitRoom.on(RoomEvent.AudioPlaybackStatusChanged, updatePlayback);
    livekitRoom.on(RoomEvent.TrackPublished, updateMicrophones);
    livekitRoom.on(RoomEvent.TrackUnpublished, updateMicrophones);
    livekitRoom.on(RoomEvent.TrackMuted, updateMicrophones);
    livekitRoom.on(RoomEvent.TrackUnmuted, updateMicrophones);
    livekitRoom.on(RoomEvent.LocalTrackPublished, updateMicrophones);
    livekitRoom.on(RoomEvent.LocalTrackUnpublished, updateMicrophones);
    livekitRoom.on(RoomEvent.ParticipantConnected, updateMicrophones);
    livekitRoom.on(RoomEvent.ParticipantDisconnected, updateMicrophones);
    livekitRoom.on(RoomEvent.MediaDevicesError, (error) => {
      setMicrophoneState('denied');
      setMicrophoneError(humanizeMediaError(error));
    });

    if (import.meta.env.DEV) {
      const tag = (event: string) => `[livekit:${roomId}] ${event}`;
      livekitRoom.on(RoomEvent.ConnectionStateChanged, (state) => console.debug(tag('connectionState'), state));
      livekitRoom.on(RoomEvent.Reconnecting, () => console.debug(tag('reconnecting')));
      livekitRoom.on(RoomEvent.Reconnected, () => console.debug(tag('reconnected')));
      livekitRoom.on(RoomEvent.SignalConnected, () => console.debug(tag('signalConnected')));
      livekitRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => console.debug(tag('connectionQuality'), { participant: participant.identity, quality }));
      livekitRoom.on(RoomEvent.LocalTrackPublished, (publication) => console.debug(tag('localTrackPublished'), { sid: publication.trackSid, source: publication.source }));
      livekitRoom.on(RoomEvent.LocalTrackUnpublished, (publication) => console.debug(tag('localTrackUnpublished'), { sid: publication.trackSid, source: publication.source }));
      livekitRoom.on(RoomEvent.TrackPublished, (publication, participant) => console.debug(tag('remoteTrackPublished'), { participant: participant.identity, sid: publication.trackSid, source: publication.source }));
      livekitRoom.on(RoomEvent.TrackSubscribed, (_track, publication, participant) => console.debug(tag('trackSubscribed'), { participant: participant.identity, sid: publication.trackSid }));
      livekitRoom.on(RoomEvent.TrackSubscriptionFailed, (sid, participant) => console.debug(tag('trackSubscriptionFailed'), { participant: participant.identity, sid }));
      livekitRoom.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => console.debug(tag('trackUnsubscribed'), { participant: participant.identity, sid: publication.trackSid }));
      livekitRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => console.debug(tag('audioPlaybackStatus'), { canPlaybackAudio: livekitRoom.canPlaybackAudio }));
      livekitRoom.on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant) => console.debug(tag('permissionsChanged'), { participant: participant.identity, canPublish: participant.permissions?.canPublish }));
    }

    const connect = async () => {
      try {
        setConnectionState(ConnectionState.Connecting);
        const credentials = await getVoiceToken(roomId);
        if (disposed) return;
        await livekitRoom.connect(credentials.url, credentials.token, { autoSubscribe: true });
        if (disposed) {
          await livekitRoom.disconnect();
          return;
        }
        setRoom(livekitRoom);
        setConnectionState(livekitRoom.state);
        updateMicrophones();
        updatePlayback();
      } catch (error) {
        if (!disposed) {
          setConnectionState(ConnectionState.Disconnected);
          setMicrophoneError(error instanceof Error ? error.message : 'Could not connect to room audio.');
        }
      }
    };
    void connect();

    return () => {
      disposed = true;
      setRoom(null);
      setAudioLevels({});
      setMicrophoneEnabled({});
      livekitRoom.removeAllListeners();
      void livekitRoom.disconnect();
      audioRoot.remove();
    };
  }, [enabled, roomId]);

  useEffect(() => {
    if (!room || connectionState !== ConnectionState.Connected) return;
    let cancelled = false;
    const updateRole = async () => {
      if (shouldPublish) {
        setMicrophoneState('starting');
        setMicrophoneError(null);
        try {
          await room.localParticipant.setMicrophoneEnabled(true, { echoCancellation: true, noiseSuppression: true });
          if (cancelled) {
            await disableRoomMicrophone(room);
            return;
          }
          setMicrophoneState('on');
          setMicrophoneEnabled((state) => ({ ...state, [room.localParticipant.identity]: true }));
        } catch (error) {
          if (!cancelled) {
            setMicrophoneState(isPermissionError(error) ? 'denied' : 'off');
            setMicrophoneError(humanizeMediaError(error));
          }
        }
        return;
      }

      try {
        await disableRoomMicrophone(room);
      } finally {
        if (!cancelled) {
          setMicrophoneState('off');
          setMicrophoneEnabled((state) => ({ ...state, [room.localParticipant.identity]: false }));
        }
      }
    };
    void updateRole();
    return () => {
      cancelled = true;
    };
  }, [connectionState, room, shouldPublish]);

  const toggleMicrophone = useCallback(async () => {
    if (!room || !shouldPublish || connectionState !== ConnectionState.Connected) return;
    const enable = microphoneState !== 'on';
    setMicrophoneState(enable ? 'starting' : 'muted');
    setMicrophoneError(null);
    try {
      await room.localParticipant.setMicrophoneEnabled(enable, { echoCancellation: true, noiseSuppression: true });
      setMicrophoneState(enable ? 'on' : 'muted');
      setMicrophoneEnabled((state) => ({ ...state, [room.localParticipant.identity]: enable }));
    } catch (error) {
      setMicrophoneState(isPermissionError(error) ? 'denied' : 'off');
      setMicrophoneError(humanizeMediaError(error));
    }
  }, [connectionState, microphoneState, room, shouldPublish]);

  const resumeAudio = useCallback(async () => {
    if (!room) return;
    await room.startAudio();
    setPlaybackBlocked(!room.canPlaybackAudio);
  }, [room]);

  return { connectionState, microphoneState, microphoneError, playbackBlocked, audioLevels, microphoneEnabled, toggleMicrophone, resumeAudio };
}

function isPermissionError(error: unknown): boolean {
  return error instanceof DOMException && ['NotAllowedError', 'PermissionDeniedError'].includes(error.name);
}

function humanizeMediaError(error: unknown): string {
  if (isPermissionError(error)) return 'Microphone access was denied. Allow microphone access in your browser settings, then try again.';
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'No microphone was found. Connect one and try again.';
  if (error instanceof Error && /permission|not allowed/i.test(error.message)) return 'Your microphone is not permitted for this round or browser session.';
  return error instanceof Error ? error.message : 'The microphone could not be started.';
}

async function disableRoomMicrophone(room: Room): Promise<void> {
  await room.localParticipant.setMicrophoneEnabled(false);
  const tracks = [...room.localParticipant.audioTrackPublications.values()]
    .map((publication) => publication.track)
    .filter((track): track is NonNullable<typeof track> => Boolean(track));
  await Promise.all(tracks.map((track) => room.localParticipant.unpublishTrack(track, true)));
}
