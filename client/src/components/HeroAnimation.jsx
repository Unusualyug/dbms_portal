import Lottie from 'lottie-react';
import { useReducedMotion } from 'framer-motion';
import dbmsPulse from '../animations/dbmsPulse.json';

export default function HeroAnimation() {
  const reduceMotion = useReducedMotion();
  return <div className="hero-animation" role="img" aria-label="Database concepts visualized as a connected system">
    <Lottie animationData={dbmsPulse} loop={!reduceMotion} autoplay={!reduceMotion} />
  </div>;
}
