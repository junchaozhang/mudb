import {
    MuSocket,
    MuSocketState,
    MuSocketSpec,
    MuCloseHandler,
    MuSessionId,
    MuData,
} from '../../socket';

function noop () { }

export class MuWorkerSocket implements MuSocket {
    public state = MuSocketState.INIT;
    public sessionId:MuSessionId;

    private _socket:Worker;

    private _onclose:MuCloseHandler = noop;

    constructor (sessionId:MuSessionId, socket:Worker) {
        this.sessionId = sessionId;
        this._socket = socket;

        this._socket.onerror = (ev) => {
            console.error(`${ev.message} (${ev.filename}:${ev.lineno})`);
        };
    }

    public open (spec:MuSocketSpec) {
        if (this.state === MuSocketState.OPEN) {
            throw new Error('client-side Worker socket already open');
        }
        if (this.state === MuSocketState.CLOSED) {
            throw new Error('client-side Worker socket already closed, cannot reopen');
        }

        this.state = MuSocketState.OPEN;

        // perform a two-way "handshake" to ensure server is ready before sending messages
        // 1. client sends server the session id as a SYN
        // 2. server responds with the session id as an ACK

        this._socket.onmessage = (ev) => {
            if (ev.data.sessionId !== this.sessionId) {
                this._socket.terminate();
                throw new Error('invalid ACK from server');
            }

            // reset handler after receiving the ACK from server
            this._socket.onmessage = ({ data }) => {
                spec.message(data.message, data.unreliable);
            };
            this._onclose = spec.close;

            spec.ready();
        };

        // send session id to server as a SYN
        this._socket.postMessage({ sessionId: this.sessionId });
    }

    public send (message:MuData, unreliable_?:boolean) {
        if (this.state !== MuSocketState.OPEN) {
            return;
        }

        const unreliable = !!unreliable_;
        if (typeof message === 'string') {
            this._socket.postMessage({
                message,
                unreliable,
            });
        } else {
            this._socket.postMessage(
                {
                    message,
                    unreliable,
                },
                [ message.buffer ],
            );
        }
    }

    public close () {
        if (this.state !== MuSocketState.OPEN) {
            this.state = MuSocketState.CLOSED;
            return;
        }

        this.state = MuSocketState.CLOSED;
        this._socket.terminate();
        this._onclose();
    }
}

export function createWorkerSocket (spec:{
    sessionId:MuSessionId,
    serverWorker:Worker,
}) {
    return new MuWorkerSocket(spec.sessionId, spec.serverWorker);
}
