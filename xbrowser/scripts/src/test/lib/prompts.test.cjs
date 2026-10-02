'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getGuideStep, GUIDE_STEPS, BROWSER_DISPLAY_NAMES } = require('../../src/lib/prompts.cjs');

describe('prompts', () => {
  describe('getGuideStep', () => {
    it('step 0 (default) returns guide-start with quick/custom options', () => {
      const r = getGuideStep(0);
      assert.equal(r.step, 0);
      assert.equal(r.awaits_user_input, true);
      assert.equal(r.options.length, 2);
      assert.equal(r.options[0].value, 'quick');
      assert.equal(r.options[1].value, 'custom');
      assert.equal(r.recommended, 'quick');
      assert.equal(r.user_choice_mapping.quick, 'xb config reset');
      assert.equal(r.user_choice_mapping.custom, 'xb guide config --step 1');
      // 防回归：旧字段不应再存在
      assert.equal(r.default, undefined);
      assert.equal(r.next_action, undefined);
    });

    it('step 1 with installed browsers awaits user input', () => {
      const r = getGuideStep(1, { browsers: ['chrome', 'edge'] });
      assert.equal(r.step, 1);
      assert.equal(r.awaits_user_input, true);
      assert.equal(r.options.length, 3);
      assert.equal(r.options[0].value, 'cft');
      assert.equal(r.options[1].value, 'chrome');
      assert.equal(r.options[2].value, 'edge');
      assert.equal(r.recommended, 'cft');
      assert.equal(r.user_choice_mapping.cft,    'xb config set browser=cft');
      assert.equal(r.user_choice_mapping.chrome, 'xb config set browser=chrome');
      assert.equal(r.user_choice_mapping.edge,   'xb config set browser=edge');
      assert.ok(r.next_step_hint);
      // 防回归
      assert.equal(r.default, undefined);
      assert.equal(r.next_action, undefined);
    });

    it('step 1 with no local browsers does NOT await user input', () => {
      const r = getGuideStep(1, { browsers: [] });
      assert.equal(r.step, 1);
      assert.equal(r.awaits_user_input, false);
      assert.equal(r.auto_set, true);
      assert.equal(r.options.length, 1);
      assert.equal(r.options[0].value, 'cft');
      assert.equal(r.recommended, 'cft');
      assert.equal(r.user_choice_mapping.cft, 'xb config set browser=cft');
    });

    it('step 2 returns headed-select with windowed option first and awaits user input', () => {
      const r = getGuideStep(2);
      assert.equal(r.step, 2);
      assert.equal(r.awaits_user_input, true);
      assert.equal(r.options.length, 2);
      assert.equal(r.options[0].value, 'true');
      assert.equal(r.options[1].value, 'false');
      assert.equal(r.recommended, 'true');
      assert.equal(r.user_choice_mapping.true,  'xb config set headed=true');
      assert.equal(r.user_choice_mapping.false, 'xb config set headed=false');
      assert.ok(r.note.includes('--headed'));
      // 防回归
      assert.equal(r.default, undefined);
      assert.equal(r.next_action, undefined);
    });

    it('close-browser returns 3 options with browser name and awaits user input', () => {
      const r = getGuideStep('close-browser', { browserId: 'chrome' });
      assert.equal(r.step, 'close-browser');
      assert.equal(r.awaits_user_input, true);
      assert.equal(r.options.length, 3);
      assert.equal(r.options[0].value, 'confirmed');
      assert.equal(r.options[1].value, 'force');
      assert.equal(r.options[2].value, 'skip');
      assert.ok(r.message.includes('Google Chrome'));
      assert.equal(r.recommended, 'confirmed');
      assert.equal(r.user_choice_mapping.confirmed, 'xb stop chrome --force');
      assert.equal(r.user_choice_mapping.force,     'xb stop chrome --force');
      assert.equal(r.user_choice_mapping.skip,      null);
      assert.ok(r.skip_hint);
      // 防回归
      assert.equal(r.next_action, undefined);
    });

    it('incomplete-config returns reset/guide options and awaits user input', () => {
      const r = getGuideStep('incomplete-config', { config: { browser: null } });
      assert.equal(r.step, 'incomplete-config');
      assert.equal(r.awaits_user_input, true);
      assert.equal(r.options.length, 2);
      assert.equal(r.options[0].value, 'reset');
      assert.equal(r.options[1].value, 'guide');
      assert.ok(r.message.includes('browser'));
      assert.equal(r.recommended, 'reset');
      assert.equal(r.user_choice_mapping.reset, 'xb config reset');
      assert.equal(r.user_choice_mapping.guide, 'xb guide config --step 1');
      // 防回归
      assert.equal(r.default, undefined);
      assert.equal(r.next_action, undefined);
    });

    it('unknown step returns error', () => {
      const r = getGuideStep('nonexistent');
      assert.ok(r.error);
    });
  });

  describe('BROWSER_DISPLAY_NAMES', () => {
    it('contains expected browser keys', () => {
      for (const key of ['cft', 'chrome', 'edge', 'qqbrowser']) {
        assert.ok(BROWSER_DISPLAY_NAMES[key], `missing key: ${key}`);
      }
    });
  });
});

// Tests for shield prompts (Task 11)
const { describe: dS, it: iS } = require('node:test');
const aS = require('node:assert/strict');
const { getGuideStep: getGuideStepS } = require('../../src/lib/prompts.cjs');

dS('shield-allow prompt', () => {
  iS('returns awaits_user_input=true with confirm/cancel', () => {
    const r = getGuideStepS('shield-allow', { target: '192.168.1.10:8080' });
    aS.equal(r.awaits_user_input, true);
    aS.equal(r.recommended, 'cancel');
    aS.ok(r.message.includes('192.168.1.10:8080'));
    aS.ok(r.message.includes('30 分钟') || r.message.includes('30分钟'));
    aS.deepEqual(r.options.map((o) => o.value).sort(), ['cancel', 'confirm']);
    aS.equal(r.user_choice_mapping.confirm, 'xb shield allow 192.168.1.10:8080');
    aS.equal(r.user_choice_mapping.cancel, null);
  });
});

dS('shield-off prompt', () => {
  iS('returns awaits_user_input=true with date placeholder', () => {
    const r = getGuideStepS('shield-off', {});
    aS.equal(r.awaits_user_input, true);
    aS.equal(r.recommended, 'cancel');
    aS.ok(r.message.includes('YYYYMMDD') || r.message.includes('日期'));
    aS.ok(r.user_choice_mapping.confirm.startsWith('xb shield disable '));
    aS.equal(r.user_choice_mapping.cancel, null);
  });
});
