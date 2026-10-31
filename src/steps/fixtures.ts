import { createBdd, test as base } from 'playwright-bdd';
import { FormAgent } from '../agent/form-agent';

export const test = base.extend<{ agent: FormAgent }>({
  agent: async ({ page }, use, testInfo) => {
    const agent = new FormAgent(page, testInfo);
    await use(agent);
    await agent.finish();
  },
});

export const { Given, When, Then } = createBdd(test);
