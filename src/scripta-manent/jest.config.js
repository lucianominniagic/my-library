/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // ts-jest compiles TypeScript.  We override only the settings that would
  // otherwise break in a plain Node/CommonJS environment.
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Jest runs in CommonJS; override the Next.js esnext / bundler settings
          module: 'commonjs',
          moduleResolution: 'node',
          // Keep decorator support
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          // Standard TS options
          esModuleInterop: true,
          strict: true,
          jsx: 'react-jsx',
          target: 'ES2017',
          // Needed so ts-jest resolves @/* aliases the same way as Next.js
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
          // Skip lib checks for faster compilation
          skipLibCheck: true,
        },
        // Keep diagnostics on so TypeScript errors surface as test failures
        diagnostics: {
          warnOnly: false,
        },
      },
    ],
  },

  // Resolve @/* path aliases at Jest module-resolution time
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Load reflect-metadata before any test file so that TypeORM decorators
  // (which call Reflect.metadata()) find the augmented Reflect object.
  setupFiles: ['reflect-metadata'],

  // Only transform next/* from node_modules (it ships some ESM-only code)
  transformIgnorePatterns: ['/node_modules/(?!(next)/)'],

  // Collect coverage from the two route files under test
  collectCoverageFrom: [
    'src/app/api/upload/cover/route.ts',
    'src/app/api/covers/[id]/route.ts',
  ],
};
