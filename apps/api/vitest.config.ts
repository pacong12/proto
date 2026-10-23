import { defineConfig, mergeConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

// Run this project's tests with the shared aliases from the root config.
export default mergeConfig(rootConfig, defineConfig({}));
