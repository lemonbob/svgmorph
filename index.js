/** @format */

import $morph from './morph_module.js'

let isMorphing = false;

const wait = async (time) => {
	return new Promise((resolve) => setTimeout(resolve, time));
};

const init = async () => {
	if (isMorphing === false) {
		isMorphing = true;
		let promiseArray = [];
		let pathArray = document.querySelectorAll('.svg path');
		let sourcePaths = document.querySelectorAll('.svg-store path');
		console.log('start');
		for (let i = 0; i < sourcePaths.length; i++) {
			for (let j = 0; j < pathArray.length; j++) {
				let sourceIndex = (i + 1 + j) % sourcePaths.length;
				$morph.set(pathArray[j], sourcePaths[sourceIndex], 1000);
			}
			//await wait(16);
			await $morph.animate();
		}
		console.log('morph complete');
		isMorphing = false;
	}
};

document.querySelector('.svg-wrapper').addEventListener('click', init);
