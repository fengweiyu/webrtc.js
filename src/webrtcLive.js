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

var oPlayer=null

class WebRtcLive 
{
    constructor(mediaDataSource, config) 
    {
        if (mediaDataSource.type.toLowerCase() !== 'live') 
        {
            console.log('webrtcLive requires an webrtc MediaDataSource input!');
        }
        this.isLongConnect = true;
        if (mediaDataSource.isLongConnect === false) 
        {
            this.isLongConnect = false;
        }

        this.m_PlayURL = mediaDataSource.url;  // in seconds
        this.m_MediaElement = null;
        this.m_PeerConnection = null;
        this.m_LocalSDP = null;
        this.m_iceCandidateCountOK = null;
        this.candidateSDP = null;
		this.m_localElement = null;
        oPlayer=this;
    }


	isLocalIP(ip) 
    {
        // 检查IP地址是否是内网地址
        // 排除私有地址范围
        if (
          /^10\./.test(ip) || // 10.x.x.x
          /^192\.168\./.test(ip) || // 192.168.x.x
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) // 172.16.x.x - 172.31.x.x
        ) {
          return true
        }

        // 排除保留地址
        if (
          /^127\./.test(ip) || // 127.x.x.x (loopback)
          /^169\.254\./.test(ip) // 169.254.x.x (link-local)
          // 还可以添加其他保留地址的检查，如多播地址等
        ) {
          return true
        }
        if (ip.length > 15) {
          console.log('ip length --->', ip.length)
          return true
        }
        console.log('ip=====>', ip)
        // 其他条件下认为是公网地址
        return false
    }
    doCall(param,url)
	{
        this.NegotiateSDP(param,url);
	}
    GetPlayStatus() 
	{
        if (this.isLongConnect === false) 
        {
            return;
        }
    
    	var xhr = new XMLHttpRequest();
    	xhr.open('GET', this.m_PlayURL, true);
		xhr.setRequestHeader("Accessol-Allow-Origin","*");
    	xhr.onreadystatechange = function() {
			if (xhr.readyState === XMLHttpRequest.DONE) {
				if (xhr.status === 200||xhr.status === 204) {
					// 收到服务器响应，连接仍然活跃
					console.log('PlayStatus(exit) OK ,status:'+xhr.status+' msg:'+xhr.statusText);
				} else {
					// 连接出现问题，处理断开连接的逻辑
					console.log('PlayStatus err,code:'+xhr.status+' msg:'+xhr.statusText);
                    alert('PlayStatus err,code:'+xhr.status+' msg:'+xhr.statusText);
				}
			}
   	 	};
    	xhr.send();
	}
    NegotiateSDP(param,url)
	{
		var json = {
			"action":"offer",
			"sdp":param,
		}

		let playUrl = this.m_PlayURL;
		//var playUrl = "http://139.9.149.150:9018/test/202404h264g711a.flv.webrtc";//test 2024h264aac.h264 2024h264g711a.flv
		var xhr=new XMLHttpRequest();
		xhr.onreadystatechange = function(){
		             console.log('xhr readyState',xhr.readyState);
		            //alert(xhr.status);
		            if(xhr.readyState==4){
		                if(xhr.status==200||xhr.status==304){
		                    var data = xhr.responseText;
							var jsonstr = JSON.parse(data)
		                    console.log(jsonstr);
							let anwser = {};
							anwser.sdp = jsonstr.sdp;
							anwser.type = 'answer';
							console.log('answer:', jsonstr.sdp);
							oPlayer.m_PeerConnection.setRemoteDescription(anwser).then(() => {
                                console.log('NegotiateSDP pc set remote sucess');
								oPlayer.GetPlayStatus();//一次就够，维持长链接
								}).catch(e => {
                                    console.log( e);
							});
		                }else {// 连接出现问题，处理断开连接的逻辑
                            console.log('NegotiateSDP err,code:'+xhr.status+' msg:'+xhr.statusText);
                            alert('NegotiateSDP err,code:'+xhr.status+' msg:'+xhr.statusText);
                        }
		            }
		         }
		xhr.open("POST",playUrl,true);
		//如果是POST请求方式，设置请求首部信息
		xhr.setRequestHeader("Content-type","application/json; charset=utf-8");
		//xhr.setRequestHeader("Connection","Keep-Alive");
		xhr.setRequestHeader("Access-Control-Allow-Headers","Access-Control-Allow-Origin, ClientType,Accept-Encoding,Content-Type,Access-Token,Authorization,authorization,Token,Tag,Cache-Control");
		xhr.setRequestHeader("Accessol-Allow-Origin","*");
		var jsonStr = JSON.stringify(json);
		xhr.send(jsonStr);
	}
    handleCandidate(event,url) 
	{
		if (event.candidate) 
        {
			console.log('Remote ICE candidate: \r\n ' + event.candidate.candidate+'\r\niceCandidateCount'+this.m_iceCandidateCountOK);
			const candidateIP = event.candidate.candidate.split(' ')[4] // 提取ICE候选中的IP地址
			var hasLocalIP=this.isLocalIP(candidateIP)
			if (!hasLocalIP) 
            {//过滤掉无效的，比如.local这种会导致服务设置candidate失败
				if (this.candidateSDP) 
				{
					this.candidateSDP += 'a=' + event.candidate.candidate + '\r\n'
				}
				else
				{
					this.candidateSDP = 'a=' + event.candidate.candidate + '\r\n'	
				}
                if (!this.m_LocalSDP) 
				{
					console.log('localSDP:null');
                    return;
				}
				this.m_iceCandidateCountOK++;// 每收到一个候选都增加计数
				if(this.m_iceCandidateCountOK==1)
				{
					var searchStringAudio = 'm=audio';
					var indexAudio = this.m_LocalSDP.indexOf(searchStringAudio);	
					var searchStringVideo = 'm=video';
					var indexVideo = this.m_LocalSDP.indexOf(searchStringVideo);	
					var indexPos = 0;
					if(indexVideo > indexAudio)
					{
						indexPos = indexVideo;
					}
					else
					{
						indexPos = indexAudio;
					}
					this.m_LocalSDP = this.m_LocalSDP.substring(0, indexPos) +this.candidateSDP+ this.m_LocalSDP.substring(indexPos);
					//this.candidateSDP=null;
				}
				if(this.m_iceCandidateCountOK>=2)
				{
					console.log('ICE negotiation finished. All ICE candidates have been done.',this.m_PlayURL);
					// // Send the candidate to the remote peer
					//m_LocalSDP.replace(/a=ice-options:trickle/g, '');
					var searchString = 'a=ice-options:trickle';
					var index = this.m_LocalSDP.indexOf(searchString);//去掉a=ice-options:trickle，candidate和sdp一起发
					this.m_LocalSDP = this.m_LocalSDP.substring(0, index) + this.m_LocalSDP.substring(index + searchString.length+2);
					var index = this.m_LocalSDP.indexOf(searchString);//去掉a=ice-options:trickle，candidate和sdp一起发
					this.m_LocalSDP = this.m_LocalSDP.substring(0, index) + this.m_LocalSDP.substring(index + searchString.length+2);
					this.m_LocalSDP+=this.candidateSDP;
					console.log('localSDP:', this.m_LocalSDP);
					this.doCall(this.m_LocalSDP,this.m_PlayURL);
					this.candidateSDP=null;
					this.m_LocalSDP=null;
					this.m_iceCandidateCountOK = 0;
				}
			}
		}
    }



    attachMediaElement(mediaElement,localElement=null) 
    {
        this.m_MediaElement = mediaElement;
		this.m_localElement = localElement;
    }

    detachMediaElement() 
    {
        if (this.m_MediaElement) 
        {
            this.m_MediaElement = null;
        }
    }

    load() 
    {
        //oPlayer=player;
        this.m_PeerConnection = new RTCPeerConnection({
            iceServers: [
                {
                urls: ['stun:stun.voipbuster.com:3478'] //stun:stun.oss.aliyuncs.com:3478
                }
            ]
            });
        this.m_PeerConnection.onicecandidate = function(event){
            oPlayer.handleCandidate(event,this.m_PlayURL);
        };
        this.m_PeerConnection.onicecandidateerror = function(event){
            console.log('onicecandidateerror');
        };
        this.m_PeerConnection.ontrack = function(event){
            if (event.track.kind === 'audio') {
                // 处理音频流
                console.log('audio:');//, event.track.length
            } else if (event.track.kind === 'video') {
                // 处理视频流
                console.log('video:');//, event.track.length
            }

            if (oPlayer.m_MediaElement && event.streams && event.streams.length > 0) {
                let eventStream = event.streams[0];
                eventStream.getTracks().forEach(track => {
                    if (track.kind === 'audio') {
                        console.log('This is an audio track',event.streams.length);
                        } else if (track.kind === 'video') {
                        console.log('This is a video track',event.streams.length);
                    }
                  })
                  oPlayer.m_MediaElement.srcObject = eventStream;
            } else {
                console.log('wait stream track finish');
            }
        };
        this.m_PeerConnection.onconnectionstatechange = function(event){
            console.log('当前状态==>',event.currentTarget.connectionState);
        };
    }

    unload() 
    {
        console.log('Ending call');
        this.m_PeerConnection.close();
        //pc = null;//不注释会报错
    }

    play() 
    {
		var AudioTransceiverInit = null;

		const VideoTransceiverInit = {
			direction: 'sendrecv',//recvonly
			sendEncodings: []
		};
		this.m_PeerConnection.addTransceiver('video', VideoTransceiverInit);
		/*if(null != localStream)
		{
			AudioTransceiverInit = {
				//streams:[localStream],//这个是添加接收者的
				direction: 'sendrecv'//recvonly
			};
			m_PeerConnection.addTransceiver(localStream.getTracks()[0], AudioTransceiverInit);//这么做虽然可以发送音频流，但是无法动态的启停
			console.log('AudioTransceiverInit sendrecv');
		}
		else*/
		{
			AudioTransceiverInit = {
				direction: 'sendrecv'//recvonly
			};
			this.m_PeerConnection.addTransceiver('audio', AudioTransceiverInit);//这样会触发两次onicecandidate
		}

		this.m_PeerConnection.createOffer().then(desc => {
			//log('offer:', desc.sdp);
			this.m_PeerConnection.setLocalDescription(desc).then(() => {
			//			doCall(desc.sdp)
                oPlayer.m_LocalSDP=desc.sdp;
			});
			}).catch(e => {
				log(e);
		});
    }

    pause() 
    {
        this.m_MediaElement.pause();
    }

    destroy() 
    {
        this.unload();
        this.detachMediaElement();
        oPlayer=null;
    }


    
}

export default WebRtcLive;