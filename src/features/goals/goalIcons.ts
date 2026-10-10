import {
  Bike,
  Camera,
  Car,
  Gamepad2,
  Gift,
  GraduationCap,
  Headphones,
  Heart,
  House,
  Laptop,
  PawPrint,
  Plane,
  Shirt,
  Smartphone,
  Sofa,
  Target,
  Tv,
  Watch,
  type LucideIcon,
} from 'lucide-react';

// Icons for goals, stored by key in goals.icon. Things people save up for; imported one by one so
// the bundle only carries these.
export const GOAL_ICONS: Readonly<Record<string, LucideIcon>> = {
  target: Target,
  smartphone: Smartphone,
  laptop: Laptop,
  headphones: Headphones,
  camera: Camera,
  watch: Watch,
  'gamepad-2': Gamepad2,
  tv: Tv,
  bike: Bike,
  car: Car,
  plane: Plane,
  house: House,
  sofa: Sofa,
  shirt: Shirt,
  gift: Gift,
  'graduation-cap': GraduationCap,
  'paw-print': PawPrint,
  heart: Heart,
};

export const GOAL_ICON_KEYS = Object.keys(GOAL_ICONS);

export function goalIcon(key: string): LucideIcon {
  return GOAL_ICONS[key] ?? Target;
}
