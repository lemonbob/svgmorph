/**
 * Super Morph by M J Livesey
 * ©2021 M J Livesey Polymathic Design
 * GitHub lemonbob
 * 
 * This module can be used without modification, please contact the copyright holder to request permission to modify
 * No liability for damage will be accepted, this software is provided to use at own risk  
 *
 * Module will morph one SVG path to another. It can morph upto 100 paths simultaneously at 60fps  * 
 * 
 * To use, call $morph.set() to setup one or more morphing objects
 * method accepts 5 params
 * startPath, destPath DOM path tags, animationDuration, animationDelay (numbers in ms), animationTiming (string - "linear"/"ease-in"/"ease-out"/"ease")
 * call $morph.animate() to animate all active morphing objects
 * $morph.animate returns a promise that will resolve once the animations are complete
 * animations are stored in a private stack and are removed once complete
 * to abort animations (for example navigating away from a component) always call $morph.destroy()
 * this should be called on the beforeDestroy lifecycle hook
 *
 * @format
 */

//PRIVATE


let _animationArray = [];
let _pathPrecision = 10;
let _isAnimationActive = false;

let _srcPathNode = document.createElementNS('http://www.w3.org/2000/svg', 'path');
let _destPathNode = document.createElementNS('http://www.w3.org/2000/svg', 'path');

/**
 *
 * @param {Object} pathSrc
 * @param {Object} pathDest
 * @param {Number} animationDuration
 * @param {Number} animationDelay
 * @param {String} animationTiming
 */
const _setMorph = (pathSrc, pathDest, animationDuration = 1000, animationDelay = 0, animationTiming = 'linear') => {
	let dSrc = pathSrc.getAttribute('d');
	let dDest = pathDest.getAttribute('d');
	let srcPathMatches = dSrc.match(/[mM][^mM]*/g);
	let destPathMatches = dDest.match(/[mM][^mM]*/g);
	let nPathLength = srcPathMatches.length >= destPathMatches.length ? srcPathMatches.length : destPathMatches.length;
	let srcPointBuffer = [];
	let diffPointBuffer = [];
	let destPointBuffer = [];
	let lastSrcPoint;
	let lastDestPoint;
    
	for (let k = 0, kLen = nPathLength; k < kLen; k++) {
		let srcPathString = srcPathMatches[k] ? srcPathMatches[k] : 'M0,0';
		let destPathString = destPathMatches[k] ? destPathMatches[k] : 'M0,0';

		//adjust first move for relative move paths of nested multi-path tags
		if (srcPathString[0] === 'm' && k > 0) srcPathString = `M${lastSrcPoint.x},${lastSrcPoint.y} ${srcPathString}`;            
		if (destPathString[0] === 'm' && k > 0) destPathString = `M${lastDestPoint.x},${lastDestPoint.y} ${destPathString}`;            
		
		_srcPathNode.setAttribute('d', srcPathString);
		_destPathNode.setAttribute('d', destPathString);

		let pathSrcLength = Math.floor(_srcPathNode.getTotalLength()),
			pathDestLength = Math.floor(_destPathNode.getTotalLength()),
			srcPoints = [],
			destPoints = [],
			diffPoints = [],
			srcRatio = 1,
			destRatio = 1,
			longestPathLength;

		if (pathSrcLength > pathDestLength) {
			destRatio = pathDestLength / pathSrcLength;
			longestPathLength = pathSrcLength;
		} else {
			srcRatio = pathSrcLength / pathDestLength;
			longestPathLength = pathDestLength;
		}

		let srcStartIndex = 0,
			destStartIndex = 0,
			srcMin = Infinity,
			destMin = Infinity,
			srcMax = 0,
			destMax = 0,
			srcMinPoint = { x: 0, y: 0 },
			srcMaxPoint = { x: 0, y: 0 },
			destMinPoint = { x: 0, y: 0 },
			destMaxPoint = { x: 0, y: 0 };

		//do not start at 0 to avoid move location for double moves
		let i = 0.01;
		let srcPoint = _srcPathNode.getPointAtLength(i * srcRatio);
		let destPoint = _destPathNode.getPointAtLength(i * destRatio);

        srcPoints.push({ x: srcPoint.x, y: srcPoint.y });
		destPoints.push({ x: destPoint.x, y: destPoint.y });
        
		i += _pathPrecision;
		let c = 1;

        //always ensure we have the path matching the end point
		while (i <= longestPathLength) {
			let srcPoint = _srcPathNode.getPointAtLength(i * srcRatio);
			let destPoint = _destPathNode.getPointAtLength(i * destRatio);
			srcPoints.push({ x: srcPoint.x, y: srcPoint.y });
			destPoints.push({ x: destPoint.x, y: destPoint.y });
			let combinedSrcPoint = srcPoint.x + srcPoint.y;
			let combinedDestPoint = destPoint.x + destPoint.y;
			//set the minimum and maximum absolute points - use the min (top left) as the start index
			if (combinedSrcPoint < srcMin) {
				srcMin = combinedSrcPoint;
				srcMinPoint = srcPoint;
				srcStartIndex = c;
			}
			if (combinedDestPoint < destMin) {
				destMin = combinedDestPoint;
				destMinPoint = destPoint;
				destStartIndex = c;
			}
			if (combinedSrcPoint > srcMax) {
				srcMax = combinedSrcPoint;
				srcMaxPoint = srcPoint;
			}
			if (combinedDestPoint > destMax) {
				destMax = combinedDestPoint;
				destMaxPoint = destPoint;
			}
            if (i !== longestPathLength && i + _pathPrecision * 2 > longestPathLength) i = longestPathLength; 
			else i += _pathPrecision;
			c++;
		}

		lastSrcPoint = srcPoints[srcPoints.length - 1];
		lastDestPoint = destPoints[destPoints.length - 1];

		if (srcStartIndex != 0) {
			srcPoints.splice(0, 0, ...srcPoints.splice(srcStartIndex, srcPoints.length - srcStartIndex));
		}
		if (destStartIndex != 0) {
			destPoints.splice(0, 0, ...destPoints.splice(destStartIndex, destPoints.length - destStartIndex));
		}

		//calculate the middle of a removed vector
		let srcMidPoint = { x: 0, y: 0 };
		let destMidPoint = { x: 0, y: 0 };
		        
        if (srcPathString === 'M0,0') {
            srcMidPoint.x += (destMinPoint.x + destMaxPoint.x) / 2;
            srcMidPoint.y += (destMinPoint.y + destMaxPoint.y) / 2;
        }
		else if (destPathString === 'M0,0') {
            destMidPoint.x += (srcMinPoint.x + srcMaxPoint.x) / 2;
            destMidPoint.y += (srcMinPoint.y + srcMaxPoint.y) / 2;
        }       

		//precalculate the differential vectors
		for (let i = 0, iLen = srcPoints.length; i < iLen; i++) {
			srcPoints[i].x += srcMidPoint.x;
			srcPoints[i].y += srcMidPoint.y;
			destPoints[i].x += destMidPoint.x;
			destPoints[i].y += destMidPoint.y;
			let x = destPoints[i].x - srcPoints[i].x;
			let y = destPoints[i].y - srcPoints[i].y;
			diffPoints.push({ x: x, y: y });
		}
		srcPointBuffer.push(srcPoints);
		destPointBuffer.push(destPoints);
		diffPointBuffer.push(diffPoints);        
	}
	//create the animation object
	let promiseResolve;
	let animationPromise = new Promise((resolve) => {
		promiseResolve = resolve;
	});
	_animationArray.push({
		index: _animationArray.length,
		startTime: undefined,
		p: 0,
		srcPoints: srcPointBuffer,
		diffPoints: diffPointBuffer,
		pathNode: pathSrc,
		destPath: pathDest.getAttribute('d'),
		destStyle: pathDest.getAttribute('style'),
		isBegin: false,
		animationDuration: animationDuration,
		animationDelay: animationDelay,
		animationPromise: animationPromise,
		resolve: promiseResolve
	});	
};

/**
 * async animation call
 */
const _animateMorph = async () => {
	if (_isAnimationActive === false) requestAnimationFrame(_animateSVGMorph);
	await Promise.all(_animationArray.map((v) => v.animationPromise));
};

/**
 *
 * @param {Array} srcPoints
 * @param {Array} diffPoints
 * @param {Number} p
 * @param {Object} SVGPath
 */
const _convertPointsToPath = (srcPointBuffer, diffPointBuffer, p = 0, SVGPath) => {
	let path = '';
	for (let j = 0, jLen = srcPointBuffer.length; j < jLen; j++) {
		let srcPoints = srcPointBuffer[j];
		let diffPoints = diffPointBuffer[j];

		path += 'M';

		for (let i = 0, len = srcPoints.length; i < len; i++) {
			let resultPointX = srcPoints[i].x + diffPoints[i].x * p;
			let resultPointY = srcPoints[i].y + diffPoints[i].y * p;
			path += resultPointX + ',' + resultPointY;
			if (i < len - 1) path += 'L';
			else path += 'z';
		}
	}
	SVGPath.setAttribute('d', path);
};

/**
 * animation callback
 * @param {Number} timestamp
 * @returns
 */
const _animateSVGMorph = (timestamp) => {
	_isAnimationActive = false;
	for (let i = _animationArray.length - 1; i >= 0; i--) {
		let animation = _animationArray[i];
		//initialize the animation
		if (animation.startTime == undefined) animation.startTime = timestamp;

		if (animation.p >= 1) {
			animation.pathNode.setAttribute('d', animation.destPath);
			animation.resolve();
			_animationArray.splice(i, 1);
		} else {
			_isAnimationActive = true;
			if (timestamp - animation.startTime - animation.animationDelay > 0) {
				if (animation.isBegin === false && animation.destStyle != undefined) animation.pathNode.setAttribute('style', animation.destStyle);
				animation.isBegin = true;
				animation.p = (timestamp - animation.startTime - animation.animationDelay) / animation.animationDuration;
				_convertPointsToPath(animation.srcPoints, animation.diffPoints, animation.p, animation.pathNode);
			}
		}
	}

	if (_isAnimationActive === false) {
		return;
	} else {
		return requestAnimationFrame(_animateSVGMorph);
	}
};

/**
 * destroys all current animations and clears the animation stack
 */
const _destroy = () => {
	for (let i = _animationArray.length - 1; i >= 0; i--) {
		let animation = _animationArray[i];
		animation.pathNode.setAttribute('d', animation.destPath);
		animation.resolve();
		_animationArray.splice(i, 1);
	}
};

//PUBLIC

let $morph = {};
$morph.set = _setMorph;
$morph.animate = _animateMorph;
$morph.destroy = _destroy;

export default $morph; 
