// One rigid transform for the supplied Unity/glTF house. One source metre = 1.4 game metres.
// The source's right-hand entrance faces the chase lane after a 180-degree Y rotation.
export const HOME_SCALE = 1.4;
export const SOURCE_DOOR = { x: 4.17, z: -4.5715 };
export const homePoint = (x, y, z) => [82 + (SOURCE_DOOR.x - x) * HOME_SCALE, y * HOME_SCALE, 12.7 + (SOURCE_DOOR.z - z) * HOME_SCALE];
const a = homePoint(4.23, 0, -2.81), b = homePoint(-1.46, 1.908, -8.47);
export const HOME = {
  x0: a[0], x1: b[0], z0: a[2], z1: b[2], h: b[1],
  door: { z0: homePoint(0, 0, -4.019)[2], z1: homePoint(0, 0, -5.0522)[2], h: 1.576 * HOME_SCALE },
};

// Destination tests use tracked head X/Z, independent of XR height and origin.
export function atHomeApproach(point){
  const z=(HOME.door.z0+HOME.door.z1)/2;
  return point.x>=HOME.x0-2.5&&point.x<=HOME.x0+.35&&Math.abs(point.z-z)<1.1;
}
