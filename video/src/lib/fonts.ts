import { continueRender, delayRender } from 'remotion';
import { loadFont as loadChakra } from '@remotion/google-fonts/ChakraPetch';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const chakra = loadChakra();
const inter  = loadInter();

export const FONT_HEADLINE = chakra.fontFamily; // 'Chakra Petch'
export const FONT_BODY     = inter.fontFamily;  // 'Inter'

// Called at module level in Root.tsx to stall rendering until fonts are ready
const fontHandle = delayRender('Loading fonts');
Promise.all([chakra.waitUntilDone(), inter.waitUntilDone()]).then(() =>
  continueRender(fontHandle),
);
