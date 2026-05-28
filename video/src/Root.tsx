import { Composition } from 'remotion';
import { StarlineVideo, TOTAL_FRAMES } from './Video';

// Side-effect: loads Chakra Petch + Inter and delays rendering until ready
import './lib/fonts';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="StartlineDemo"
    component={StarlineVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{}}
  />
);
