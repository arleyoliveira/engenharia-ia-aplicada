import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: 'h2bxpb',
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: '**/*.cy.ts',
    supportFile: false,
  },
});
