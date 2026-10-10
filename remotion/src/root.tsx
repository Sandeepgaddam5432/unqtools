import React from 'react';
import {Composition} from 'remotion';
import {UnQToolsReel} from './unqtools-reel';
export const RemotionRoot: React.FC = () => <Composition id="UnQToolsReel" component={UnQToolsReel} durationInFrames={1800} fps={30} width={1080} height={1920}/>;
