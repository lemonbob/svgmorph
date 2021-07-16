# Svg Morph
High Speed SVG Morphing

## [morph.polymathicdesign.com](http:/morph.polymathicdesign.com)

**High Speed Morphing of SVG paths 100+ paths at 60fps and 4000 vector points** 

Module will morph one SVG path to another. It can morph upto 100 paths simultaneously at 60fps 

* To use, call $morph.set() to setup one or more morphing objects
* method accepts 5 params
* startPath, destPath DOM path tags, animationDuration, animationDelay (numbers in ms), animationTiming (string - "linear"/"ease-in"/"ease-out"/"ease")
* call $morph.animate() to animate all active morphing objects
* $morph.animate returns a promise that will resolve once the animations are complete
* animations are stored in a private stack and are removed once complete
* to abort animations (for example navigating away from a component) always call $morph.destroy()
* this should be called on the beforeDestroy lifecycle hook

