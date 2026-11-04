import { startLifecycle } from '@/lifecycle/lifecycle';

export default defineBackground(() => {
  startLifecycle();
});
