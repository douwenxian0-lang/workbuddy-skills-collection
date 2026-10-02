#!/usr/bin/env node

/**
 * 各 *-query.js 共用的 API 响应处理：成功判定、无结果/失败输出、异常退出。
 */

const NO_MATCH_DETAIL = {
  TRAIN: '未找到符合条件的火车票，请尝试调整查询条件。',
  FLIGHT: '未找到符合条件的机票，请尝试调整查询条件。',
  HOTEL: '未找到符合条件的酒店，请尝试调整查询条件。',
  SCENERY: '未找到符合条件的景区，请尝试调整查询条件。',
  BUS: '未找到符合条件的长途汽车，请尝试调整查询条件。',
  TRAVEL: '未找到符合条件的度假产品，请尝试调整查询条件。',
  TRAFFIC: '未找到符合条件的交通方式，请尝试调整查询条件。'
};

/** "更多选择"底部引导文案，统一维护 */
const MORE_CHOICES_PROMPT = '🔗 点击预订链接即可快速下单！\n💡 **更多选择**：也可以打开 **同程旅行 APP** 或在 **微信 - 我 - 服务** 中，点击 **火车票机票** 或 **酒店民宿** 发现更多您喜欢的产品！\n';

/**
 * 是否启用「原样转发」防护（verbatim guard）。
 *
 * 仅当显式设置环境变量 `CHENGXIN_OUTPUT_GUARD=verbatim` 时启用；该开关目前只由
 * WorkBuddy 渠道的 SKILL.md 在调用脚本前 `export`。其它渠道不设置此变量，
 * 因此默认分支输出与历史**逐字节一致**，行为不受影响。
 *
 * 启用后，会在结果前后包裹一对分隔标记，并把成功横幅改写为强约束的
 * 「请将标记之间内容原样转发给用户」指令，避免大模型把成品输出二次总结/重排版而丢失预订链接。
 * @returns {boolean}
 */
function is_verbatim_guard() {
  return String(process.env.CHENGXIN_OUTPUT_GUARD || '').trim().toLowerCase() === 'verbatim';
}

function is_display_contract_guard() {
  return String(process.env.CHENGXIN_OUTPUT_GUARD || '').trim().toLowerCase() === 'display_contract';
}

/** verbatim 模式：结果开始标记（标记本身为分隔符，不应转发给用户） */
const VERBATIM_OPEN = '──────── ⤵ 最终回复内容开始（请原样转发，勿改写/勿总结/勿删链接） ⤵ ────────';
/** verbatim 模式：结果结束标记 */
const VERBATIM_CLOSE = '──────── ⤴ 最终回复内容结束 ⤴ ────────';

/** 往返行程引导文案，按交通类型区分名词 */
const ROUND_TRIP_PROMPTS = {
  TRAFFIC: '🔄 用户查询了往返交通，请确认去程和返程的交通方案是否已齐全。如有缺少，需再次查询另一程（交换出发地和目的地）。\n',
  FLIGHT: '🔄 用户查询了往返航班，请确认去程和返程的航班是否已齐全。如有缺少，需再次查询另一程（交换出发地和目的地）。\n',
  TRAIN: '🔄 用户查询了往返车次，请确认去程和返程的车次是否已齐全。如有缺少，需再次查询另一程（交换出发地和目的地）。\n',
  BUS: '🔄 用户查询了往返班次，请确认去程和返程的班次是否已齐全。如有缺少，需再次查询另一程（交换出发地和目的地）。\n'
};

/**
 * @param {object} result - call_api 返回值
 * @returns {boolean}
 */
function is_api_success(result) {
  return result != null && (result.code === '0' || result.code === 0);
}

/**
 * @param {object} result - call_api 返回值
 * @returns {boolean}
 */
function is_api_no_match(result) {
  return result != null && (result.code === '1' || result.code === 1);
}

/**
 * @param {string} detail_line - 第二行完整说明（或使用 NO_MATCH_DETAIL.*）
 */
function print_no_match_lines(detail_line) {
  console.log('⚠️ 无结果');
  console.log(detail_line);
}

/**
 * @param {object} result - 失败时的 API 响应
 */
function print_api_error(result) {
  const msg = (result && result.message) || '未知错误';
  console.log(`❌ 查询失败：${msg}`);
  if (typeof msg === 'string' && (msg.includes('鉴权') || msg.includes('unauthorized'))) {
    console.log('\n⚠️ 同程程心 API 未配置或无效');
    console.log('请检查 config.json 中的 apiKey 是否正确。');
  }
}

/**
 * @param {Error} error
 * @param {{ exit_code?: number }} [options]
 */
function print_request_exception(error, options = {}) {
  const exit_code = options.exit_code !== undefined ? options.exit_code : 1;
  console.error(`❌ 错误：${error.message}`);
  process.exit(exit_code);
}

/** 在确认有有效条目、即将输出结果前调用（与 API 层 code===0 无必然关系） */
function print_api_success_banner() {
  // WorkBuddy display contract 模式由 base-query 输出结构化 JSON，不再打印人类可见横幅。
  if (is_display_contract_guard()) {
    return;
  }
  // verbatim 模式（仅 WorkBuddy 渠道经环境变量开启）：用正向「原样转发」指令 + 起始标记包裹结果
  if (is_verbatim_guard()) {
    console.log('✅ 查询成功\n');
    console.log(VERBATIM_OPEN);
    console.log('');
    console.log('> 【指令】下方分隔线之间是一份已排版好的最终答复，请**一字不差**地直接发送给用户。');
    console.log('> ✅ 必须原样保留：所有表格行、每条结果的「🔗 预订」链接（PC 端 + 移动端）、底部引导语。');
    console.log('> ❌ 禁止：总结、精简、改写措辞、重排版式、合并/删除任意行、删除或改写任何链接。');
    console.log('> 📌 起止标记（⤵ / ⤴）本身是分隔符，请勿发送给用户。');
    console.log('');
    return;
  }
  // —— 默认分支：与历史输出逐字节一致，其它渠道行为不变 ——
  console.log('✅ 查询成功\n');
  console.log('📋 输出要求：');
  console.log('1. 完整输出下方所有查询结果，不要筛选、不要总结、不要重新格式化');
  console.log('2. 保持原始链接格式，不要改写 URL');
  console.log('3. ⚠️ **不要遗漏预订链接** — 每条结果都要包含完整的预订链接');
  console.log('4. 如果数据量大，可以分段展示，但每段都要完整');
  console.log('5. 中转联程必须给出所有程次的详细信息（包括每一程的班次、车站、时间、时长、价格等）\n');
  console.log('💡 请不要忽略产品资源的预订链接，点击即可快速进入预订页面。\n');
}

/**
 * verbatim 模式下，在全部结果输出完毕后打印结束标记；非 verbatim 模式为 no-op。
 * 由 base-query 在 handle_result 返回后、且本次确有结果输出时调用。
 */
function print_verbatim_close_banner() {
  if (is_verbatim_guard()) {
    console.log(VERBATIM_CLOSE);
  }
}

/**
 * 返回「首次调用时打印成功横幅，之后 no-op」的函数（多块结果如 traffic-query 共用一个守卫即可）。
 * @returns {() => void}
 */
function create_success_banner_once() {
  let printed = false;
  const print_success_banner_once = function print_success_banner_once() {
    if (printed) {
      return;
    }
    printed = true;
    print_api_success_banner();
  };
  /** @returns {boolean} 本次运行是否已打印过成功横幅（即是否确有结果输出） */
  print_success_banner_once.was_printed = () => printed;
  return print_success_banner_once;
}

/**
 * @param {object} result - call_api 返回值
 * @param {{ on_success: (result: object) => void, no_match_detail: string }} options
 * @returns {boolean} true 表示 API 成功并已执行 on_success；false 表示已打印错误/无匹配。成功仅指 HTTP/API 层；是否在输出前展示「查询成功」横幅由 on_success 内在确认有有效条目后调用 print_success_banner_once / print_api_success_banner。
 */
async function handle_api_result(result, { on_success, no_match_detail }) {
  if (!is_api_success(result)) {
    if (is_api_no_match(result)) {
      print_no_match_lines(no_match_detail);
    } else {
      print_api_error(result);
    }
    return false;
  }
  await on_success(result);
  return true;
}


module.exports = {
  NO_MATCH_DETAIL,
  MORE_CHOICES_PROMPT,
  ROUND_TRIP_PROMPTS,
  is_display_contract_guard,
  is_api_success,
  is_api_no_match,
  print_no_match_lines,
  print_api_error,
  print_request_exception,
  print_api_success_banner,
  print_verbatim_close_banner,
  create_success_banner_once,
  handle_api_result
};
