// Field of view that fits the screen: the game is framed for landscape, so on
// narrower screens widen the vertical FOV until the horizontal view matches 4:3.
const D = Math.PI / 180;
const BASE_FOV = 40, MIN_ASPECT = 4 / 3;

const hfov = (vfov, aspect) => 2 * Math.atan(Math.tan(vfov * D / 2) * aspect) / D;

function fovForAspect(aspect) {
  if (aspect >= MIN_ASPECT) return BASE_FOV;
  return 2 * Math.atan(Math.tan(hfov(BASE_FOV, MIN_ASPECT) * D / 2) / aspect) / D;
}

export { BASE_FOV, hfov, fovForAspect };
