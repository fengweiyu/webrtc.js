/*
 * Copyright (C) 2020-2025 Hanson Yu All Rights Reserved.
 *
 * @author yu weifeng 
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import WebRtcLive from './webrtcLive.js';//Node.js 的模块系统
import WebRtcTalk from './webrtcTalk.js';
import WebRtcVideoCall from './webrtcVideoCall.js';

// factory method
function createPlayer(mediaDataSource, optionalConfig) {
    let mds = mediaDataSource;
    if (mds == null || typeof mds !== 'object') {
        console.log('MediaDataSource must be an javascript object!');
    }

    if (!mds.hasOwnProperty('type')) {
        console.log('MediaDataSource must has type field to indicate video file type!');
    }

    switch (mds.type) {
        case 'live':
            return new WebRtcLive(mds, optionalConfig);
        case 'talk':
            return new WebRtcTalk(mds, optionalConfig);
        case 'VideoCall':
            return new WebRtcVideoCall(mds, optionalConfig);
        default:
            console.log('mds.type err ' + mds.type);
    }
}

// interfaces
let webrtcjs = {};

webrtcjs.createPlayer = createPlayer;



export default webrtcjs;


