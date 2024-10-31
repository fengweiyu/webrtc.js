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

class WebRtcVideoCall 
{
    constructor(mediaDataSource, config) 
    {
        if (mediaDataSource.type.toLowerCase() !== 'VideoCall') 
        {
            console.log('WebRtcVideoCall requires an webrtc MediaDataSource input!');
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
		this.m_localFrameRate = config.localFrameRate;
		this.m_localFrameWidth = config.localFrameWidth;
		this.m_localFrameHeight = config.localFrameHeight;
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
			"FrameRate":this.m_localFrameRate
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
		if (this.m_localElement) 
		{
			this.m_localElement = null;
		}
    }

    load() 
    {
		var frameRate = this.m_localFrameRate;

		this.m_PeerConnection = new RTCPeerConnection({
			encodings: [
				{maxBitrate:2000*1000,maxFramerate:frameRate,scaleResolutionDownBy:1.0} // 第一个编码配置，设置最大比特率和不进行分辨率缩放
				//{ maxBitrate: 1000000, scaleResolutionDownBy: 2.0 }, // 第二个编码配置，设置最大比特率和将分辨率缩放为原来的一半
				//{ maxBitrate: 500000, scaleResolutionDownBy: 4.0 }   // 第三个编码配置，设置最大比特率和将分辨率缩放为原来的四分之一
			],
			iceServers: [{
				urls: ['stun:stun.voipbuster.com:3478'] //stun:stun.oss.aliyuncs.com:3478 stun:gwm-000-cn-0448.bcloud365.net:3478
		}]});
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
		console.log('local frameRate:'+this.m_localFrameRate+'frameWidth:'+this.m_localFrameWidth+' frameHeight:'+this.m_localFrameHeight);
		if (screen.orientation === 0 || screen.orientation === 180) 
			{  
				console.log("竖屏");  
				this.m_localFrameHeight = frameWidth;//手机端竖屏宽高和实际出流的相反
				this.m_localFrameWidth = frameHeight;
			} 
			else if (screen.orientation === 90 || screen.orientation === -90) 
			{  
				console.log("横屏");  
		} 
		navigator.mediaDevices.getUserMedia({ video: {
			width: oPlayer.m_localFrameWidth,//frameHeight//手机端宽高和实际出流的相反
			height: oPlayer.m_localFrameHeight,//frameWidth
			//frameRate: 30,
			frameRate: { ideal: oPlayer.m_localFrameRate, max: oPlayer.m_localFrameRate },//就算设置25，webrtc rtp时间戳间隔还是按照30的帧率
			facingMode: 'user',//前置摄像头facingMode: user ,'environment'表示要使用后置摄像头
			// 设置I帧间隔为60（大多数浏览器仅支持设置I帧间隔）
			video: {mandatory: {maxKeyFrameInterval: 60}}
			}, audio: true 
		}).then(function(stream) {
			// 开始采集视频
			var frameRate = oPlayer.m_localFrameRate;
			var frameWidth = oPlayer.m_localFrameWidth;
			var frameHeight = oPlayer.m_localFrameHeight;
			// 获取视频轨道
			const settingsVideoTrack = stream.getVideoTracks()[0];
			// 获取并输出当前帧率
			const settings = settingsVideoTrack.getSettings();
			console.log('Current frameRate: '+settings.frameRate,'frameRate: '+frameRate,'Width:', settings.width, 'Height:', settings.height,'frameWidth:', frameWidth, 'frameHeight:', frameHeight);
			if(frameRate!=settings.frameRate||frameWidth!=settings.width||frameHeight!=settings.height)
			{
				settings.frameRate=frameRate;
				settings.width=frameWidth;
				settings.height=frameHeight;
				//settingsVideoTrack.applyConstraints(settings);//无效
				//const settingV = settingsVideoTrack.getSettings();
				//console.log('settings frameRate: '+settingV.frameRate,'frameRate: '+frameRate,'Width:', settingV.width, 'Height:', settingV.height,'frameWidth:', frameWidth, 'frameHeight:', frameHeight);
			}
			const capabilities = settingsVideoTrack.getCapabilities();
			if (capabilities.frameRate) {
				const frameRatef = capabilities.frameRate.max; // 设置帧率为最大支持的值
				console.log('max frame rate: ' + frameRatef);
			};
			// 设置新的帧率
			//const newSettings = Object.assign({}, settings, { frameRate: 25 });//就算设置25，webrtc rtp时间戳间隔还是按照30的帧率
			//settingsVideoTrack.applyConstraints({ advanced: [newSettings] })

			console.log('getUserMedia audio video');
			oPlayer.m_localElement.srcObject = stream;
			oPlayer.m_PeerConnection.addTransceiver(stream.getAudioTracks()[0], { direction: 'sendrecv' });//
			oPlayer.m_PeerConnection.addTransceiver(stream.getVideoTracks()[0], { direction: 'sendrecv' });//音视频对讲
			let senders = oPlayer.m_PeerConnection.getSenders();
			// 获取当前编码参数
			// 遍历发送器列表
			senders.forEach(sender => {
				// 获取发送器的编码参数
				if(sender.track.kind === 'video') {
					let parameters = sender.getParameters();
					// 获取编码器参数中的最大比特率
					if(parameters.encodings && parameters.encodings.length > 0) {
						console.log('sender.getParameters: ' + parameters.degradationPreference+'maxFramerate'+parameters.encodings[0].maxFramerate+'maxBitrate'+parameters.encodings[0].maxBitrate);
						parameters.degradationPreference="maintain-framerate";
						//parameters.encodings[0].maxTemporalLayer = 2;// 属性设置为2，您可以将I帧间隔设置为50
						//parameters.encodings[0].maxKeyFrameDistance=60;
						parameters.encodings[0].maxFramerate = frameRate;//30
						// 设置最大比特率为500000 bps（即1000kbps）
						parameters.encodings[0].maxBitrate = 200000;
						// 应用更新的编码参数
						//sender.setParameters(parameters);
						//console.log('sender.setParameters: ' + parameters.encodings[0].maxTemporalLayer+'maxFramerate'+parameters.encodings[0].maxFramerate+'maxBitrate'+parameters.encodings[0].maxBitrate);
						
					}
				}
			});

			oPlayer.m_PeerConnection.createOffer().then(desc => {
				console.log('pcTalk.createOffer');
				oPlayer.m_PeerConnection.setLocalDescription(desc).then(() => {
					//console.log('pcTalk.setLocalDescription',desc.sdp);
					oPlayer.m_LocalSDP=desc.sdp;
				});
				}).catch(e => {
					log(e);
			});
		})
		.catch(function(error) {
			console.log('getUserMedia audio video err',error);
		});


    }

    pause() 
    {
        this.m_MediaElement.pause();
		this.m_localElement.pause();
    }

    destroy() 
    {
        this.unload();
        this.detachMediaElement();
        oPlayer=null;
    }


    
}

export default WebRtcVideoCall;