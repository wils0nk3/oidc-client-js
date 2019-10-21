// Copyright (c) Brock Allen & Dominick Baier. All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

import { Log } from './Log.js';
import { CheckSessionIFrame } from './CheckSessionIFrame.js';

export class SessionMonitor {

    constructor(userManager, CheckSessionIFrameCtor = CheckSessionIFrame) {
        if (!userManager) {
            Log.error("SessionMonitor.ctor: No user manager passed to SessionMonitor");
            throw new Error("userManager");
        }

        this._userManager = userManager;
        this._CheckSessionIFrameCtor = CheckSessionIFrameCtor;

        this._userManager.events.addUserLoaded(this._start.bind(this));
        this._userManager.events.addUserUnloaded(this._stop.bind(this));

        this._userManager.getUser().then(user => {
            // doing this manually here since calling getUser 
            // doesn't trigger load event.
            if (user) {
                this._start(user);
            }
            else if (this._settings.monitorAnonymousSession) {
                this._userManager.querySessionStatus().then(session => {
                    this._start(session);
                })
                .catch(err => {
                    // catch to suppress errors since we're in a ctor
                    Log.error("SessionMonitor ctor: error from querySessionStatus:", err.message);
                });
            }
        }).catch(err => {
            // catch to suppress errors since we're in a ctor
            Log.error("SessionMonitor ctor: error from getUser:", err.message);
        });
    }

    get _settings() {
        return this._userManager.settings;
    }
    get _metadataService() {
        return this._userManager.metadataService;
    }
    get _client_id() {
        return this._settings.client_id;
    }
    get _checkSessionInterval() {
        return this._settings.checkSessionInterval;
    }
    get _stopCheckSessionOnError() {
        return this._settings.stopCheckSessionOnError;
    }

    _start(user) {
        let session_state = user.session_state;

        if (session_state) {
            if (user.profile) {
                this._sub = user.profile.sub;
                this._sid = user.profile.sid;
                Log.debug("SessionMonitor._start: session_state:", session_state, ", sub:", this._sub);
            }
            else {
                Log.debug("SessionMonitor._start: session_state:", session_state, ", anonymous user");
            }

            if (!this._checkSessionIFrame) {
                this._metadataService.getCheckSessionIframe().then(url => {
                    if (url) {
                        Log.debug("SessionMonitor._start: Initializing check session iframe")

                        let client_id = this._client_id;
                        let interval = this._checkSessionInterval;
                        let stopOnError = this._stopCheckSessionOnError;

                        this._checkSessionIFrame = new this._CheckSessionIFrameCtor(this._callback.bind(this), client_id, url, interval, stopOnError);
                        this._checkSessionIFrame.load().then(() => {
                            this._checkSessionIFrame.start(session_state);
                        });
                    }
                    else {
                        Log.warn("SessionMonitor._start: No check session iframe found in the metadata");
                    }
                }).catch(err => {
                    // catch to suppress errors since we're in non-promise callback
                    Log.error("SessionMonitor._start: Error from getCheckSessionIframe:", err.message);
                });
            }
            else {
                this._checkSessionIFrame.start(session_state);
            }
        }
    }

    _stop() {
        this._sub = null;
        this._sid = null;

        if (this._checkSessionIFrame) {
            Log.debug("SessionMonitor._stop");
            this._checkSessionIFrame.stop();
        }
    }

    _callback() {
        this._userManager.querySessionStatus().then(session => {
            var raiseUserSignedOutEvent = true;

            if (session) {
                if (session.sub === this._sub) {
                    raiseUserSignedOutEvent = false;
                    this._checkSessionIFrame.start(session.session_state);

                    if (session.sid === this._sid) {
                        Log.debug("SessionMonitor._callback: Same sub still logged in at OP, restarting check session iframe; session_state:", session.session_state);
                    }
                    else {
                        Log.debug("SessionMonitor._callback: Same sub still logged in at OP, session state has changed, restarting check session iframe; session_state:", session.session_state);
                        this._userManager.events._raiseUserSessionChanged();
                    }
                }
                else {
                    Log.debug("SessionMonitor._callback: Different subject signed into OP:", session.sub);
                }
            }
            else {
                Log.debug("SessionMonitor._callback: Subject no longer signed into OP");
            }

            if (raiseUserSignedOutEvent) {
                Log.debug("SessionMonitor._callback: SessionMonitor._callback; raising signed out event");
                this._userManager.events._raiseUserSignedOut();
            }
        }).catch(err => {
            Log.debug("SessionMonitor._callback: Error calling queryCurrentSigninSession; raising signed out event", err.message);
            this._userManager.events._raiseUserSignedOut();
        });
    }
}
