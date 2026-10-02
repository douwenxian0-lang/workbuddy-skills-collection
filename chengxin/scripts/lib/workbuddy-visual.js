#!/usr/bin/env node

/**
 * WorkBuddy 渠道展示协议 v2。
 *
 * 脚本负责生成稳定 Markdown 与本地 HTML 文件；WorkBuddy Agent 只需要输出
 * markdown，并对 htmlFilePath 调用 present_files。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const zlib = require('zlib');

const LOGO_DATA_URI = load_logo_data_uri();

function is_display_contract_guard() {
  return String(process.env.CHENGXIN_OUTPUT_GUARD || '').trim().toLowerCase() === 'display_contract';
}

async function build_workbuddy_visual_response(response_data, options = {}) {
  const fallback_markdown = normalize_markdown(options.fallback_markdown || '');
  const request_params = options.request_params || {};
  const items = collect_visual_items(response_data);
  const title = infer_title(items, request_params);
  const stats = build_stats(items);
  const itineraryMode = is_itinerary_request(items, request_params);
  // 行程规划场景：构建结构化行程模型，供 Markdown 与 HTML 共用（一日一日、分点建议）
  const itineraryModel = itineraryMode ? build_itinerary_model(items, request_params, title) : null;
  const advice = itineraryModel ? render_itinerary_advice_text(itineraryModel) : build_advice(title, items, request_params);
  const markdown = build_markdown(title, items, fallback_markdown, advice, request_params, itineraryModel);
  const summary_markdown = markdown;

  let html_result = {};
  if (items.length > 0) {
    try {
      await enrich_qr_data_uris(items, options);
      await enrich_plan_activity_qr_data_uris(items, options);
      html_result = write_html_file(title, items, request_params, stats, advice, options, itineraryModel);
    } catch (error) {
      html_result = { fallbackReason: `HTML 生成失败：${error.message}` };
    }
  }

  return {
    type: 'workbuddy_present_files',
    version: '2.0',
    renderMode: 'present_files_html',
    summaryMarkdown: summary_markdown,
    markdown,
    finalAnswerInstruction: '最终回复必须完整输出 markdown 字段原文。present_files/HTML 只是补充展示，不能替代对话内 Markdown。不要自行总结、压缩、重排或只提示查看右侧 HTML。',
    responsePolicy: {
      finalAnswerField: 'markdown',
      mode: 'verbatim',
      mustNotRewriteMarkdown: true,
      mustDisplayInChat: true,
      presentFilesIsSupplementOnly: true,
      forbidSummaryOnlyFinalAnswer: true,
      finalAnswerMustStartWith: `### ${title}`,
      requiredFinalAnswerSections: [itineraryMode ? '行程安排建议' : '推荐建议', '预订', '客服支持'],
      requiredMarkdownColumns: ['预订'],
      requiredTransportMarkdownHeaders: {
        flight: '| 序号 | 航班 | 出发到达 | 日期 | 时间 | 时长 | 价格 | 预订 |',
        train: '| 序号 | 车次 | 出发到达 | 日期 | 时间 | 历时 | 票价/席别 | 预订 |',
        bus: '| 序号 | 班次 | 出发到达 | 日期 | 时间 | 车程 | 票价 | 预订 |'
      },
      presentFilesField: 'htmlFilePath'
    },
    htmlFilePath: html_result.htmlFilePath || '',
    htmlFileName: html_result.htmlFileName || '',
    adviceMarkdown: advice,
    presentFilesInstruction: html_result.htmlFilePath
      ? `调用 present_files 展示文件：${html_result.htmlFilePath}`
      : '',
    stats,
    fallbackReason: html_result.fallbackReason || ''
  };
}

function collect_visual_items(data) {
  const items = [];
  if (!data || typeof data !== 'object') {
    return items;
  }

  collect_from_list_groups(data.trainDataList, 'trainList', 'train', items);
  collect_from_list_groups(data.flightDataList, 'flightList', 'flight', items);
  collect_from_list_groups(data.busDataList, 'busList', 'bus', items);
  collect_from_list_groups(data.hotelDataList, 'hotelList', 'hotel', items);
  collect_from_list_groups(data.sceneryDataList, 'sceneryList', 'scenery', items);
  collect_from_list_groups(data.tripDataList, 'tripList', 'travel', items);
  collect_from_list_groups(data.tripDataList, 'productList', 'travel', items);

  const plans = data.tripPlanDataList;
  if (Array.isArray(plans)) {
    plans.forEach((group) => {
      const list = group.planList || group.tripPlanList || [];
      list.forEach((plan) => items.push(to_visual_item(plan, 'plan', group)));
    });
  }

  return items.filter(Boolean);
}

function collect_from_list_groups(groups, list_key, type, items) {
  if (!Array.isArray(groups)) {
    return;
  }
  groups.forEach((group) => {
    const list = group && group[list_key];
    if (Array.isArray(list)) {
      const groupLinkSource = pick_group_link_source(group);
      list.forEach((item) => items.push(to_visual_item(item, type, group, groupLinkSource)));
    }
  });
}

function pick_group_link_source(group) {
  if (!group || typeof group !== 'object') {
    return null;
  }
  if (group.workbuddyLinks || group.wechatRedirectUrl || group.pcRedirectUrl || group.redirectUrl) {
    return group;
  }
  const pageDataList = group.pageDataList;
  if (Array.isArray(pageDataList)) {
    return pageDataList.find((item) => item && (item.workbuddyLinks || item.wechatRedirectUrl || item.pcRedirectUrl || item.redirectUrl)) || null;
  }
  return null;
}

function pick_plan_link_source(plan) {
  const activities = Array.isArray(plan && plan.activitiyList) ? plan.activitiyList : [];
  return activities.find((item) => item && (item.workbuddyLinks || item.wechatRedirectUrl || item.pcRedirectUrl || item.redirectUrl)) || null;
}

function to_visual_item(raw, type, group = null, groupLinkSource = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const linkSource = type === 'plan' ? pick_plan_link_source(raw) || groupLinkSource : groupLinkSource;
  const links = extract_links(raw, linkSource);
  const details = pick_details(raw, type, group);
  const groupTitle = pick_group_title(group);
  return {
    type,
    label: label_for_type(type),
    title: pick_title(raw, type),
    subtitle: pick_subtitle(raw, type),
    price: pick_price(raw),
    route: route_title(raw, type),
    date: date_text(raw),
    time: time_range(raw),
    duration: repair_display_text(raw.runTime || duration_from_minutes(raw.runTimeMinutes) || raw.runTimeDesc || ''),
    score: score_text(raw),
    address: pick_address(raw),
    image: pick_image_url(raw, type),
    logo: pick_logo_url(raw, type),
    tags: pick_tags(raw, type),
    groupTitle,
    details,
    links,
    raw
  };
}

function pick_group_title(group) {
  if (!group || typeof group !== 'object') {
    return '';
  }
  return repair_display_text(group.desc || group.title || group.name || group.type || '');
}

function extract_links(item, fallbackSource = null) {
  const wb = item.workbuddyLinks || {};
  const fallback = fallbackSource || {};
  const fallbackWb = fallback.workbuddyLinks || {};
  return {
    pcUrl: normalize_https_url(wb.pcUrl || item.pcRedirectUrl || fallbackWb.pcUrl || fallback.pcRedirectUrl || ''),
    mobileUrl: normalize_https_url(wb.mobileUrl || item.clawRedirectUrl || item.redirectUrl || fallbackWb.mobileUrl || fallback.clawRedirectUrl || fallback.redirectUrl || ''),
    wechatPath: wb.wechatPath || item.wechatRedirectUrl || fallbackWb.wechatPath || fallback.wechatRedirectUrl || '',
    qrSourceUrl: wb.qrSourceUrl || fallbackWb.qrSourceUrl || '',
    qrWrapperUrl: normalize_https_url(wb.qrWrapperUrl || fallbackWb.qrWrapperUrl || ''),
    qrImageUrl: normalize_https_url(wb.qrImageUrl || fallbackWb.qrImageUrl || ''),
    qrDataUri: wb.qrDataUri || fallbackWb.qrDataUri || ''
  };
}

function pick_title(item, type) {
  if (type === 'flight') {
    return join_non_empty([item.airlineName, item.flightNo], ' ') || route_title(item, type) || '航班推荐';
  }
  if (type === 'train') {
    return join_non_empty([item.trainNo || item.trafficNo, train_city_route_title(item)], ' | ') || '火车票推荐';
  }
  if (type === 'bus') {
    return item.coachNo || item.busNo || item.busName || route_title(item, type) || '汽车票推荐';
  }
  if (type === 'hotel' || type === 'scenery' || type === 'travel') {
    return item.name || item.title || '推荐资源';
  }
  if (type === 'plan') {
    return item.summary || item.name || join_array((item.activitiyList || []).map((activity) => activity.name), ' - ') || '推荐行程规划';
  }
  return item.name || item.title || route_title(item, type) || '推荐资源';
}

function pick_subtitle(item, type) {
  if (type === 'hotel') {
    return join_non_empty([item.star, score_text(item), pick_address(item)], ' · ');
  }
  if (type === 'scenery') {
    return join_non_empty([scenery_location(item), score_text(item), item.rankTitle], ' · ');
  }
  if (type === 'travel') {
    return item.desc || item.describe || join_array(item.destList, '、');
  }
  if (type === 'plan') {
    const activities = Array.isArray(item.activitiyList) ? item.activitiyList : [];
    return join_non_empty([item.index ? `Day ${item.index}` : '', join_array(activities.map((activity) => activity.name), ' → ')], ' · ');
  }
  return join_non_empty([time_range(item), item.runTime || duration_from_minutes(item.runTimeMinutes), item.airlineShortName], ' · ');
}

function pick_price(item) {
  if (item.price != null && item.price !== '') {
    return String(item.price).startsWith('¥') ? String(item.price) : `¥${item.price}`;
  }
  const sceneryTicketPrice = scenery_lowest_ticket_price(item);
  if (sceneryTicketPrice) {
    return `¥${sceneryTicketPrice}`;
  }
  if (Array.isArray(item.ticketList) && item.ticketList.length > 0) {
    const first = item.ticketList.find((ticket) => ticket.ticketPrice != null);
    if (first) {
      return `¥${first.ticketPrice}`;
    }
  }
  return '';
}

function scenery_location(item) {
  return join_non_empty([item.cityName, item.countyName], ' · ');
}

function scenery_ticket_items(item) {
  const source = item.mpInfoAndFreeTicketResult;
  const list = source && Array.isArray(source.mpInfoList) ? source.mpInfoList : [];
  if (list.length > 0) {
    return list;
  }
  if (Array.isArray(item.ticketList)) {
    return item.ticketList;
  }
  return [];
}

function scenery_lowest_ticket_price(item) {
  const prices = scenery_ticket_items(item)
    .map((ticket) => numeric_price(ticket.salePrice || ticket.focusPrice || ticket.ticketPrice || ticket.price))
    .filter((price) => price > 0)
    .sort((a, b) => a - b);
  return prices.length ? prices[0] : '';
}

function scenery_ticket_summary(item) {
  return scenery_ticket_items(item)
    .map((ticket) => {
      const name = ticket.titleName || ticket.rawProductName || ticket.productName || ticket.ticketType || '门票';
      const price = ticket.salePrice || ticket.focusPrice || ticket.ticketPrice || ticket.price;
      const parts = [name];
      if (price != null && price !== '') {
        parts.push(`¥${price}`);
      }
      if (ticket.earliestOrderTime) {
        parts.push(ticket.earliestOrderTime);
      }
      if (ticket.refundDes) {
        parts.push(ticket.refundDes);
      }
      return parts.filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .slice(0, 3)
    .join('；');
}

function pick_details(item, type, group = null) {
  const details = [];
  if (type === 'flight') {
    add_detail(details, '航司', item.airlineName || item.airlineShortName);
    add_detail(details, '机型', item.aircraft);
    add_detail(details, '折扣', item.discount);
    add_detail(details, '出发', airport_display(item, 'dep') || append_terminal(item.depAirportName || item.depStationName, item.depAirportTerminal));
    add_detail(details, '到达', airport_display(item, 'arr') || append_terminal(item.arrAirportName || item.arrStationName, item.arrAirportTerminal));
  } else if (type === 'train') {
    add_detail(details, '出发站', item.depStationName || item.fromStationName);
    add_detail(details, '到达站', item.arrStationName || item.toStationName);
    add_detail(details, '席别价格', format_ticket_list(item.ticketList) || item.seatName);
  } else if (type === 'bus') {
    add_detail(details, '出发站', item.depStationName || item.fromStationName);
    add_detail(details, '到达站', item.arrStationName || item.toStationName);
    add_detail(details, '车型', item.coachType || item.busType);
  } else if (type === 'hotel') {
    add_detail(details, '品牌', item.brandName);
    add_detail(details, '设施', item.facilities);
    add_detail(details, '距离', item.distance);
    add_detail(details, '推荐理由', item.recommendReasons);
    add_detail(details, '特色', item.describe);
  } else if (type === 'scenery') {
    add_detail(details, '城市区域', scenery_location(item));
    add_detail(details, '商圈/景区', item.bdName);
    add_detail(details, '榜单', item.rankTitle);
    add_detail(details, '等级', item.star);
    add_detail(details, '主题', item.theme);
    add_detail(details, '特色', item.describe);
    add_detail(details, '开放时间', item.fullOpenTimeString || item.openTime);
    add_detail(details, '建议游玩', item.playTime);
    add_detail(details, '设施', join_array((item.facilityList || []).slice(0, 8), '、'));
    add_detail(details, '票型', scenery_ticket_summary(item));
  } else if (type === 'travel') {
    add_detail(details, '目的地', join_array(item.destList, '、'));
    add_detail(details, '地址', item.address);
    add_detail(details, '标签', join_array(item.labelList, '、'));
  } else if (type === 'plan') {
    add_detail(details, '天数', group && group.totalDays ? `${group.totalDays}天` : '');
    add_detail(details, '住宿', group && group.hotelNights ? `${group.hotelNights}晚` : '');
    add_detail(details, '美食', group && group.foods);
    add_detail(details, '预算', group && group.budget);
    add_detail(details, '特色', group && group.lineSpecialFeatures);
    add_detail(details, '景点数', group && group.sceneryCount ? `${group.sceneryCount}个` : '');
    add_detail(details, '活动', join_array((item.activitiyList || []).map((activity) => activity.name), ' → '));
  }
  return details;
}

function add_detail(details, label, value) {
  if (value != null && String(value).trim() !== '') {
    details.push({ label, value: String(value).trim() });
  }
}

function route_title(item, type) {
  if (type === 'flight') {
    const depAirport = airport_display(item, 'dep');
    const arrAirport = airport_display(item, 'arr');
    if (depAirport && arrAirport) {
      return `${depAirport} → ${arrAirport}`;
    }
  }
  if (type === 'train') {
    return train_station_route_title(item) || train_city_route_title(item);
  }
  const dep = item.depName || item.departure || item.depStationName || item.depAirportName || item.fromCityName || item.departCityName;
  const arr = item.arrName || item.destination || item.arrStationName || item.arrAirportName || item.toCityName || item.destCityName;
  return dep && arr ? `${dep} → ${arr}` : '';
}

function train_station_route_title(item) {
  const dep = item.depStationName || item.fromStationName;
  const arr = item.arrStationName || item.toStationName;
  return dep && arr ? `${dep} → ${arr}` : '';
}

function train_city_route_title(item) {
  const dep = item.depName || item.departure || item.fromCityName || item.departCityName;
  const arr = item.arrName || item.destination || item.toCityName || item.destCityName;
  return dep && arr ? `${dep} → ${arr}` : '';
}

function airport_display(item, prefix) {
  const shortName = safe_text(item[`${prefix}AirportShortName`]);
  const terminal = item[`${prefix}AirportTerminal`];
  if (shortName) {
    return append_terminal(shortName, terminal);
  }
  return safe_text(item[`${prefix}Name`]) || safe_text(item[`${prefix}AirportName`]) || '';
}

function date_text(item) {
  const value = item.date || item.flightDate || item.trainDate || item.trafficDate
    || item.depDate || item.departDate || item.departureDate || item.startDate
    || item.queryDate || item.useDate;
  if (!value) {
    return '';
  }
  const normalized = String(value).trim().replace(/\//g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    return normalized;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}月${day}日 ${weekdays[date.getDay()]}`;
}

function time_range(item) {
  const dep = item.depTime || item.departTime || item.startTime;
  const arr = item.arrTime || item.arriveTime || item.endTime;
  return dep && arr ? `${dep} - ${arr}` : (dep || '');
}

function score_text(item) {
  if (item.score == null || item.score === '') {
    return '';
  }
  const count = item.commentNum ? `（${item.commentNum}条）` : '';
  return `评分 ${item.score}${count}`;
}

function pick_address(item) {
  return join_non_empty([item.countyName, item.address], ' · ');
}

function pick_tags(item, type) {
  const tags = [];
  if (type === 'hotel') {
    [item.star, item.brandName, item.distance].forEach((tag) => add_tag(tags, tag));
  } else if (type === 'scenery') {
    [item.rankTitle, item.star, item.theme, item.cityName, item.countyName, item.playTime].forEach((tag) => add_tag(tags, tag));
  } else if (type === 'flight' || type === 'train' || type === 'bus') {
    [item.coachType || item.trainType || item.aircraft, item.discount].forEach((tag) => add_tag(tags, tag));
  } else if (type === 'travel') {
    if (Array.isArray(item.labelList)) {
      item.labelList.forEach((tag) => add_tag(tags, tag));
    }
  } else if (type === 'plan') {
    [item.index ? `Day ${item.index}` : '', ...(item.cityNameList || [])].forEach((tag) => add_tag(tags, tag));
  }
  return tags.slice(0, 6);
}

function add_tag(tags, value) {
  if (value != null && String(value).trim() !== '') {
    tags.push(String(value).trim());
  }
}

function label_for_type(type) {
  return {
    flight: '机票',
    train: '火车',
    bus: '汽车',
    hotel: '酒店',
    scenery: '景点',
    travel: '度假',
    plan: '攻略行程'
  }[type] || '推荐';
}

function infer_title(items, request_params) {
  const route = request_params.departure && request_params.destination
    ? `${request_params.departure} → ${request_params.destination}`
    : (request_params.destination || request_params.departure || '');
  if (is_itinerary_request(items, request_params)) {
    return route ? `${route} 行程规划` : '同程旅行行程规划';
  }
  const labels = items.length > 0
    ? Array.from(new Set(items.map((item) => item.label))).slice(0, 3).join(' / ')
    : '同程旅行';
  if (route) {
    return `${route} ${labels}推荐`;
  }
  return items.length > 0 ? `${labels}推荐结果` : '同程旅行查询结果';
}

function build_summary_markdown(title, items, fallback_markdown) {
  if (items.length === 0) {
    return fallback_markdown || '未找到可展示的同程旅行资源。';
  }
  return `### ${title}\n已为你整理 ${items.length} 条结果。PC 端可打开侧边栏 HTML 查看完整卡片，手机端可直接查看下方 Markdown 链接。`;
}

function build_markdown(title, items, fallback_markdown, advice, request_params = {}, itineraryModel = null) {
  if (items.length === 0) {
    return append_customer_support(fallback_markdown || '未找到可展示的同程旅行资源。');
  }

  const itineraryMode = is_itinerary_request(items, request_params);
  const adviceLines = itineraryModel
    ? build_itinerary_markdown_lines(itineraryModel)
    : (itineraryMode ? format_itinerary_markdown_lines(advice) : String(advice || '').split('\n').filter(Boolean));
  const lines = [
    `### ${title}`,
    '',
    `✅ 共找到 **${items.length}** 条同程旅行结果。PC 端可查看已生成的 HTML 页面；手机端可使用下方链接继续预订。`,
    '',
    itineraryMode ? '🧭 **行程安排建议**：' : '💡 **推荐建议**：',
    '',
    ...adviceLines,
    ''
  ];
  const groups = group_items_by_type(items);
  groups.forEach((group) => {
    lines.push(`#### ${icon_for_type(group.type)} ${group.label}（${group.items.length} 条）`);
    lines.push('');
    group_subgroups(group.items).forEach((subgroup) => {
      if (subgroup.title) {
        lines.push(`##### ${subgroup.title}（${subgroup.items.length} 条）`);
        lines.push('');
      }
      lines.push(...build_markdown_table({ ...group, items: subgroup.items }));
      lines.push('');
    });
  });
  return append_customer_support(lines.join('\n').trim());
}

function build_markdown_table(group) {
  if (group.type === 'train' || group.type === 'flight' || group.type === 'bus') {
    const rows = transport_markdown_header(group.type);
    group.items.forEach((item, index) => {
      rows.push(`| ${index + 1} | ${md_cell(item.title)} | ${md_cell(item.route || '-')} | ${md_cell(item.date || '-')} | ${md_cell(item.time || '-')} | ${md_cell(item.duration || '-')} | ${md_cell(price_or_ticket(item))} | ${md_cell(build_markdown_links(item.links) || '-')} |`);
    });
    return rows;
  }

  if (group.type === 'hotel') {
    const rows = [
      '| 序号 | 酒店 | 价格 | 评分/星级 | 位置/亮点 | 预订 |',
      '| --- | --- | --- | --- | --- | --- |'
    ];
    group.items.forEach((item, index) => {
      rows.push(`| ${index + 1} | ${md_cell(item.title)} | ${md_cell(item.price || '-')} | ${md_cell(join_non_empty([item.score, detail_value(item, '星级')], ' / ') || item.subtitle || '-')} | ${md_cell(join_non_empty([item.address, detail_value(item, '推荐理由'), detail_value(item, '特色')], '；') || '-')} | ${md_cell(build_markdown_links(item.links) || '-')} |`);
    });
    return rows;
  }

  if (group.type === 'scenery') {
    const rows = [
      '| 序号 | 景点 | 价格 | 评分/等级 | 区域/特色 | 开放/游玩 | 预订 |',
      '| --- | --- | --- | --- | --- | --- | --- |'
    ];
    group.items.forEach((item, index) => {
      rows.push(`| ${index + 1} | ${md_cell(item.title)} | ${md_cell(item.price || '-')} | ${md_cell(join_non_empty([item.score, detail_value(item, '等级'), detail_value(item, '榜单')], ' / ') || '-')} | ${md_cell(join_non_empty([detail_value(item, '城市区域'), detail_value(item, '商圈/景区'), detail_value(item, '特色')], '；') || '-')} | ${md_cell(join_non_empty([detail_value(item, '开放时间'), detail_value(item, '建议游玩')], '；') || '-')} | ${md_cell(build_markdown_links(item.links) || '-')} |`);
    });
    return rows;
  }

  if (group.type === 'plan') {
    const rows = [
      '| Day | 行程主题 | 重点景点 | 安排理由 |',
      '| --- | --- | --- | --- |'
    ];
    group.items.forEach((item, index) => {
      const activities = plan_activities(item);
      const names = join_array(activities.map((activity) => activity.name), ' → ') || detail_value(item, '活动') || '-';
      const reason = activities.map((activity) => activity.describe || activity.introduction || activity.theme).filter(Boolean).slice(0, 2).join('；')
        || '结合返回的交通、酒店和景点资源安排';
      rows.push(`| Day ${item.raw.index || index + 1} | ${md_cell(item.title)} | ${md_cell(names)} | ${md_cell(reason)} |`);
    });
    return rows;
  }

  const rows = [
    '| 序号 | 名称 | 信息 | 价格 | 预订 |',
    '| --- | --- | --- | --- | --- |'
  ];
  group.items.forEach((item, index) => {
    const info = [item.subtitle, item.route, item.time, item.duration].filter(Boolean).join('；');
    rows.push(`| ${index + 1} | ${md_cell(item.title)} | ${md_cell(info || '-')} | ${md_cell(item.price || '-')} | ${md_cell(build_markdown_links(item.links) || '-')} |`);
  });
  return rows;
}

function format_itinerary_markdown_lines(advice) {
  return String(advice || '').split('\n').map((line) => {
    const text = line.trim();
    if (!text) {
      return '';
    }
    const match = text.match(/^(Day\s*\d+｜[^：:]+)[：:](.*)$/);
    if (!match) {
      return `- ${text}`;
    }
    return `- **${match[1]}**：${match[2].trim()}`;
  }).filter(Boolean);
}

function transport_markdown_header(type) {
  if (type === 'flight') {
    return [
      '| 序号 | 航班 | 出发到达 | 日期 | 时间 | 时长 | 价格 | 预订 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |'
    ];
  }
  if (type === 'train') {
    return [
      '| 序号 | 车次 | 出发到达 | 日期 | 时间 | 历时 | 票价/席别 | 预订 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |'
    ];
  }
  return [
    '| 序号 | 班次 | 出发到达 | 日期 | 时间 | 车程 | 票价 | 预订 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |'
  ];
}

function md_cell(value) {
  return String(value == null || value === '' ? '-' : value)
    .replace(/\s*\|\s*/g, ' / ')
    .replace(/\n+/g, '<br>')
    .trim();
}

function price_or_ticket(item) {
  return detail_value(item, '席别价格') || item.price || '-';
}

function detail_value(item, label) {
  const found = (item.details || []).find((detail) => detail.label === label);
  return found ? found.value : '';
}

function build_markdown_links(links) {
  const parts = [];
  if (links.pcUrl) {
    parts.push(`[PC 端预订](${links.pcUrl})`);
  }
  if (links.mobileUrl) {
    parts.push(`[手机打开](${links.mobileUrl})`);
  }
  if (links.qrWrapperUrl) {
    parts.push(`[二维码](${links.qrWrapperUrl})`);
  } else if (links.qrImageUrl) {
    parts.push(`[二维码图片](${links.qrImageUrl})`);
  }
  return parts.join(' | ');
}

function group_items_by_type(items) {
  const order = ['flight', 'train', 'bus', 'hotel', 'scenery', 'travel', 'plan'];
  const map = new Map();
  items.forEach((item) => {
    if (!map.has(item.type)) {
      map.set(item.type, { type: item.type, label: item.label, items: [] });
    }
    map.get(item.type).items.push(item);
  });
  return Array.from(map.values()).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

function group_subgroups(items) {
  const hasNamedGroup = items.some((item) => item.groupTitle);
  if (!hasNamedGroup) {
    return [{ title: '', items }];
  }
  const map = new Map();
  items.forEach((item) => {
    const title = item.groupTitle || '其他结果';
    if (!map.has(title)) {
      map.set(title, { title, items: [] });
    }
    map.get(title).items.push(item);
  });
  return Array.from(map.values());
}

function append_customer_support(markdown) {
  const support = [
    '---',
    '',
    '#### 客服支持',
    '',
    '使用过程中遇到问题?同程旅行提供 7×24 小时服务:',
    '',
    '📞 旅行者热线:95711',
    '💬 [在线客服](https://www.ly.com/public/newhelp/CustomerService.html)'
  ].join('\n');
  const base = normalize_markdown(markdown || '');
  return base ? `${base}\n\n${support}` : support;
}

function icon_for_type(type) {
  return {
    flight: '✈️',
    train: '🚄',
    bus: '🚌',
    hotel: '🏨',
    scenery: '🏞️',
    travel: '🧳',
    plan: '🗺️'
  }[type] || '📌';
}

function icon_for_detail(label) {
  if (/地址|出发|到达|目的地/.test(label)) return '📍';
  if (/评分|等级|星级/.test(label)) return '⭐';
  if (/价格|席别/.test(label)) return '💰';
  if (/时间|天数|住宿|开放/.test(label)) return '🕒';
  if (/推荐|特色|标签/.test(label)) return '💡';
  if (/设施|车型|机型|航司|品牌/.test(label)) return '🏷️';
  return '•';
}

function build_stats(items) {
  const byType = {};
  items.forEach((item) => {
    byType[item.type] = (byType[item.type] || 0) + 1;
  });
  return {
    total: items.length,
    byType,
    hasQr: items.some((item) => Boolean(item.links.qrImageUrl || item.links.qrWrapperUrl)),
    hasPcUrl: items.some((item) => Boolean(item.links.pcUrl))
  };
}

function build_advice(title, items, request_params) {
  if (!items.length) {
    return '暂未查询到可推荐资源，建议调整日期、目的地或偏好后重新查询。';
  }
  const groups = group_items_by_type(items);
  if (is_itinerary_request(items, request_params)) {
    return build_itinerary_advices(groups, request_params).join('\n');
  }
  const parts = [];
  const transport = groups.find((group) => ['train', 'flight', 'bus'].includes(group.type));
  const hotel = groups.find((group) => group.type === 'hotel');
  const scenery = groups.find((group) => group.type === 'scenery');
  const route = request_params.departure && request_params.destination
    ? `${request_params.departure}到${request_params.destination}`
    : (request_params.destination || title);

  if (transport && transport.items.length > 0) {
    parts.push(...build_transport_advices(transport.items));
  }
  if (hotel && hotel.items.length > 0) {
    parts.push(...build_hotel_advices(hotel.items, request_params));
  }
  if (scenery && scenery.items.length > 0) {
    parts.push(...build_scenery_advices(scenery.items, request_params));
  }
  if (groups.length > 1) {
    parts.push(`本页已把 ${route} 的多类资源整合到同一个页面，建议先确定交通时间，再锁定酒店位置，最后安排景点动线。`);
  }
  return parts.join('\n') || `已为你整理 ${route} 的可预订资源，建议优先查看价格、时间、位置和预订入口，再根据个人偏好筛选。`;
}

function is_itinerary_request(items, request_params = {}) {
  const text = `${request_params.extra || ''} ${request_params.destination || ''}`.trim();
  const groups = group_items_by_type(items);
  const hasMultiTravelResources = groups.filter((group) => ['train', 'flight', 'bus', 'hotel', 'scenery', 'travel', 'plan'].includes(group.type)).length >= 3;
  return hasMultiTravelResources && (/行程|规划|攻略|自由行|路线|玩|游玩|旅行|旅游|(\d+|一|二|两|三|四|五|六|七)天/.test(text) || groups.some((group) => group.type === 'plan'));
}

function build_itinerary_advices(groups, request_params = {}) {
  const transportItems = flatten_group_items(groups, ['train', 'flight', 'bus']);
  const hotelItems = flatten_group_items(groups, ['hotel']);
  const sceneryItems = unique_items_by_title(flatten_group_items(groups, ['scenery']));
  const travelItems = unique_items_by_title(flatten_group_items(groups, ['travel']));
  const planItems = unique_items_by_title(flatten_group_items(groups, ['plan']));
  const planActivities = plan_activity_items(planItems);
  const spotItems = unique_items_by_title([...planActivities, ...sceneryItems, ...travelItems, ...planItems]);
  const fallbackSpots = destination_fallback_spots(request_params.destination);
  const days = Math.min(Math.max(infer_trip_days(request_params.extra), 2), 3);
  const departure = request_params.departure || '出发地';
  const destination = request_params.destination || '目的地';
  const transport = pick_itinerary_transport(transportItems, request_params);
  const hotel = pick_itinerary_hotel(hotelItems);
  const day1Spot = spotItems[0] || fallbackSpots[0];
  const day2Spot = spotItems.find((item) => item !== day1Spot) || fallbackSpots[1] || spotItems[0];
  const day3Spot = spotItems.find((item) => item !== day1Spot && item !== day2Spot) || fallbackSpots[2] || day1Spot;
  const hotelText = hotel
    ? `住宿建议选 ${format_hotel_brief(hotel)}，理由是评分/价格/位置在返回结果里更适合作为三天动线的落脚点`
    : `住宿建议优先选 ${destination} 核心景区或地铁/交通枢纽附近，这样早晚移动成本更低`;
  const transportText = transport
    ? `交通优先看 ${format_item_brief(transport)}，先把往返大时间定住，再反推每天游玩强度`
    : `交通先锁定 ${departure} 到 ${destination} 的到达时间，建议尽量上午或中午抵达，给第一天留出半日游空间`;
  const foodText = detail_value(planItems[0] || {}, '美食');
  const resourceBasis = itinerary_resource_basis(transportItems, hotelItems, sceneryItems, travelItems, planActivities);

  const lines = [
    `Day 1｜${departure}出发抵达${destination}：${transportText}。抵达后先入住或寄存行李，${hotelText}。下午建议安排 ${format_spot_name(day1Spot)}，选择它的原因是到达日不宜排太满，适合用轻量景点、城市地标或酒店周边体验打开节奏；晚上可以补一个湖滨/商圈/夜景散步，控制体力消耗。`,
    `Day 2｜核心深度游玩日：把 ${format_spot_name(day2Spot)} 放在全天主线，上午早点出发，下午留足排队、拍照和休息时间。这样安排的理由是第二天体力最完整，适合放互动性强、榜单高、评分高或门票价值更高的资源；如果同行有孩子，就优先选择动物园、乐园、湿地、演艺等体验型景点。`,
    `Day 3｜轻松收尾 + 返程：上午安排 ${format_spot_name(day3Spot)} 或酒店周边轻量游，午后预留返程机动时间。这样安排能避免最后一天赶路太紧，也方便根据天气、体力和门票可订情况做替换；${foodText ? `餐饮可穿插 ${short_food_text(foodText)}，` : ''}出发前重点确认酒店退房、景点开放时间、扫码入口和车站/机场距离。${resourceBasis}`
  ];

  return lines.slice(0, days);
}

function itinerary_resource_basis(transportItems, hotelItems, sceneryItems, travelItems, planActivities = []) {
  const parts = [];
  if (transportItems.length) parts.push(`${transportItems.length} 条交通资源`);
  if (hotelItems.length) parts.push(`${hotelItems.length} 条酒店资源`);
  if (sceneryItems.length) parts.push(`${sceneryItems.length} 条景点资源`);
  if (travelItems.length) parts.push(`${travelItems.length} 条度假资源`);
  if (planActivities.length) parts.push(`${planActivities.length} 个行程景点节点`);
  return parts.length
    ? ` 本方案已优先参考接口返回的${parts.join('、')}；未覆盖的餐饮、夜游和商圈动线按常规旅行经验补充。`
    : ' 当前可用资源较少，动线按常规旅行经验补充，建议最终以实际可订资源为准。';
}

function short_food_text(foodText) {
  const text = String(foodText || '').replace(/^.*?有[:：]/, '').replace(/[。.]$/, '');
  return text.split(/[、,，]/).filter(Boolean).slice(0, 4).join('、');
}

function destination_fallback_spots(destination) {
  const dest = String(destination || '');
  if (dest.includes('杭州')) {
    return ['西湖湖滨/断桥白堤', '灵隐寺/法喜寺或宋城演艺', '西溪湿地/京杭大运河'];
  }
  if (dest.includes('苏州')) {
    return ['平江路/拙政园周边', '虎丘/寒山寺', '金鸡湖/诚品书店'];
  }
  if (dest.includes('上海')) {
    return ['外滩/南京东路', '迪士尼或陆家嘴', '武康路/豫园'];
  }
  return [`${dest || '目的地'}核心景点`, `${dest || '目的地'}亲子/人气景点`, `${dest || '目的地'}轻量休闲区域`];
}

// ============================================================
// 行程规划结构化模型（一日一日、分点建议）——供 Markdown 与 HTML 共用
// ============================================================

const ITINERARY_SEGMENT_META = {
  transport: { icon: '🚄', label: '交通', tone: 'transport' },
  hotel: { icon: '🏨', label: '住宿', tone: 'hotel' },
  morning: { icon: '🌅', label: '上午', tone: 'day' },
  afternoon: { icon: '☀️', label: '下午', tone: 'day' },
  daytime: { icon: '🗺️', label: '全天', tone: 'day' },
  night: { icon: '🌙', label: '晚上', tone: 'night' },
  food: { icon: '🍜', label: '美食', tone: 'food' },
  tip: { icon: '💡', label: '贴士', tone: 'tip' },
  back: { icon: '🎫', label: '返程', tone: 'transport' }
};

/**
 * 构建结构化行程模型：以接口的 tripPlan 每日骨架为主线，
 * 叠加交通、按区域匹配的酒店、美食与贴士，形成一日一日的分点建议。
 */
function build_itinerary_model(items, request_params = {}, title = '') {
  const groups = group_items_by_type(items);
  const transportItems = flatten_group_items(groups, ['train', 'flight', 'bus']);
  const hotelItems = flatten_group_items(groups, ['hotel']);
  const sceneryItems = unique_items_by_title(flatten_group_items(groups, ['scenery']));
  const travelItems = unique_items_by_title(flatten_group_items(groups, ['travel']));
  const planItems = flatten_group_items(groups, ['plan']);
  const planMeta = planItems[0] || {};

  const departure = request_params.departure || '';
  const destination = request_params.destination || '目的地';
  const route = departure && destination ? `${departure} → ${destination}` : (destination || departure);

  const arrivalTransport = pick_arrival_transport(transportItems, departure, destination);
  const returnTransport = pick_return_transport(transportItems, departure, destination, arrivalTransport);
  const foods = parse_food_list(detail_value(planMeta, '美食'));

  const backbone = build_day_backbone(planItems, sceneryItems, travelItems, request_params);
  const usedHotels = new Set();
  const days = backbone.map((dp, idx) => build_day_segments(dp, idx, backbone.length, {
    departure, destination, arrivalTransport, returnTransport, hotelItems, usedHotels, foods
  }));

  const spotCount = numeric_or(detail_value(planMeta, '景点数'),
    unique_items_by_title(backbone.flatMap((d) => d.activities)).length);
  const nights = numeric_or(detail_value(planMeta, '住宿'), Math.max(days.length - 1, 0));

  return {
    title,
    route,
    departure,
    destination,
    days,
    dayCount: days.length,
    nights,
    spotCount,
    foods,
    budget: detail_value(planMeta, '预算') || '',
    feature: detail_value(planMeta, '特色') || '',
    highlight: build_itinerary_highlight(days, destination, foods),
    tips: build_itinerary_tips(days, foods, arrivalTransport, returnTransport)
  };
}

function build_day_backbone(planItems, sceneryItems, travelItems, request_params) {
  if (planItems.length) {
    return planItems
      .slice()
      .sort((a, b) => Number((a.raw && a.raw.index) || 0) - Number((b.raw && b.raw.index) || 0))
      .map((item) => {
        const activities = plan_activities(item);
        const county = (activities.find((a) => a && (a.countyName || a.cityName)) || {});
        return {
          index: (item.raw && item.raw.index) || '',
          summary: item.title || (item.raw && item.raw.summary) || '',
          cityNameList: (item.raw && item.raw.cityNameList) || [],
          county: county.countyName || '',
          city: county.cityName || ((item.raw && item.raw.cityNameList) || [])[0] || '',
          activities
        };
      });
  }
  const spots = unique_items_by_title([...sceneryItems, ...travelItems]);
  const fallback = destination_fallback_spots(request_params.destination);
  const days = Math.min(Math.max(infer_trip_days(request_params.extra), 2), 3);
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const spot = spots[i];
    const raw = spot ? (spot.raw || {}) : {};
    out.push({
      index: String(i + 1),
      summary: spot ? spot.title : (fallback[i] || `${request_params.destination || '目的地'}行程`),
      cityNameList: [],
      county: raw.countyName || '',
      city: raw.cityName || '',
      activities: spot ? [raw] : []
    });
  }
  return out;
}

function build_day_segments(dp, idx, total, ctx) {
  const isFirst = idx === 0;
  const isLast = idx === total - 1 && total > 1;
  const phase = isFirst ? 'arrival' : (isLast ? 'depart' : 'core');
  const phaseLabel = isFirst ? '抵达 & 轻松开场' : (isLast ? '轻松收尾 & 返程' : (idx === 1 ? '核心深度游玩日' : '深度游玩日'));

  const activities = dp.activities || [];
  const mainActivity = activities[0] || null;
  const segments = [];

  // 交通（首日到达 · 去程）
  if (isFirst) {
    const t = ctx.arrivalTransport;
    segments.push(make_segment('transport',
      t ? `去程推荐 ${format_transport_brief(t, ctx.departure, ctx.destination, '去程')}（综合价格与时间更优），先把往返大交通定住，再反推每天游玩强度。`
        : `锁定 ${ctx.departure || '出发地'} 前往 ${ctx.destination} 的车次/航班，尽量上午或中午抵达，给第一天留出半日游空间。`));
  }

  // 住宿（按当天所在区域就近匹配）
  const hotel = pick_hotel_for_day(ctx.hotelItems, dp, ctx.usedHotels);
  if (hotel && (isFirst || phase === 'core')) {
    ctx.usedHotels.add(hotel);
    const area = day_area_label(dp);
    segments.push(make_segment('hotel',
      `${format_hotel_brief(hotel)}，${area ? `就近 ${area}，` : ''}评分/价格/位置更适合作为这一段动线的落脚点。`));
  }

  // 游玩主线
  if (mainActivity) {
    const key = isFirst ? 'afternoon' : (isLast ? 'morning' : 'daytime');
    const extra = isFirst
      ? '到达日不宜排太满，用它打开节奏、就近热身即可。'
      : (isLast ? '安排在返程前的上午轻量游玩，午后预留机动与返程时间。'
        : '安排为全天主线，上午早点出发，下午留足排队、拍照与休息时间。');
    segments.push(make_segment(key, `${format_activity_brief(mainActivity)}——${activity_reason(mainActivity)}${extra}`));
  }
  // 次要景点（同日第二个点）
  if (activities[1]) {
    segments.push(make_segment('afternoon', `可串联 ${format_activity_brief(activities[1])}，与主景点就近安排、错峰游玩。`));
  }

  // 晚上（首日与核心日给夜间建议）
  if (isFirst) {
    segments.push(make_segment('night', '入住后补一段湖滨/商圈/夜景散步，就近觅食，控制首日体力消耗。'));
  } else if (phase === 'core') {
    segments.push(make_segment('night', '晚上可安排特色餐或夜景/演艺项目，结束后早点回酒店恢复体力。'));
  }

  // 返程（末日）
  if (isLast) {
    const t = ctx.returnTransport;
    segments.push(make_segment('back',
      t ? `返程推荐 ${format_transport_brief(t, ctx.destination, ctx.departure, '返程')}（综合价格与时间较优），按车次时间倒推退房与出发时间。`
        : `返程当天先确认 ${ctx.destination} 返回 ${ctx.departure || '出发地'} 的车次/航班时间，预留前往车站/机场的机动时间。`));
  }

  // 美食
  if (ctx.foods.length) {
    const pick = ctx.foods.slice(idx * 2, idx * 2 + 3);
    const list = (pick.length ? pick : ctx.foods.slice(0, 3));
    segments.push(make_segment('food', `${list.join('、')}${ctx.foods.length > list.length ? ' 等本地味道' : ''}，就近选择口碑餐厅即可。`));
  }

  // 贴士
  segments.push(make_segment('tip', day_tip(phase, mainActivity)));

  return {
    index: dp.index || String(idx + 1),
    dayNo: idx + 1,
    phase,
    phaseLabel,
    title: clean_summary_text(dp.summary) || (mainActivity && mainActivity.name) || `第 ${idx + 1} 天`,
    cityLabel: day_area_label(dp),
    activities,
    segments
  };
}

function make_segment(key, text) {
  const meta = ITINERARY_SEGMENT_META[key] || ITINERARY_SEGMENT_META.tip;
  return { key, icon: meta.icon, label: meta.label, tone: meta.tone, text: String(text || '').trim() };
}

function day_tip(phase, activity) {
  if (phase === 'arrival') {
    return '到达日优先办理入住/寄存行李，先熟悉酒店周边，避免第一天奔波太远。';
  }
  if (phase === 'depart') {
    return '出发前确认酒店退房时间、景点最晚入园/开放时间，扫码入口与车站/机场距离，预留富余时间。';
  }
  if (activity && activity.openTime) {
    return `热门景点建议提前网上购票、错峰入园；留意当日开放时间（${activity.openTime}）与天气，做好备选。`;
  }
  return '热门景点建议提前购票、错峰游玩，并根据天气与体力灵活替换动线。';
}

// 交通去程/返程按“城市”判断方向（站名如“杭州东”≠“杭州”，不能用 route 直接匹配）
function transport_city_pair(item) {
  const raw = item.raw || {};
  return {
    from: raw.depName || raw.departure || raw.fromCityName || raw.departCityName || '',
    to: raw.arrName || raw.destination || raw.toCityName || raw.destCityName || ''
  };
}

function city_name_match(a, b) {
  const x = String(a || '').replace(/(市|区|县)$/, '').trim();
  const y = String(b || '').replace(/(市|区|县)$/, '').trim();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function transport_direction_matches(item, from, to) {
  if (!from || !to) return false;
  const pair = transport_city_pair(item);
  return city_name_match(pair.from, from) && city_name_match(pair.to, to);
}

// 综合价格与时间（各占一半）选取性价比最优的交通，避免只按单一维度
function pick_best_value_transport(items) {
  if (!items || !items.length) return null;
  const scored = items.map((item) => ({ item, price: numeric_price(item.price), mins: duration_minutes(item.duration) }));
  const prices = scored.map((s) => s.price).filter((p) => p > 0);
  const times = scored.map((s) => s.mins).filter((m) => m > 0);
  if (!prices.length && !times.length) return items[0];
  const minP = Math.min.apply(null, prices.length ? prices : [0]);
  const maxP = Math.max.apply(null, prices.length ? prices : [0]);
  const minT = Math.min.apply(null, times.length ? times : [0]);
  const maxT = Math.max.apply(null, times.length ? times : [0]);
  const norm = (v, min, max) => (v > 0 && max > min) ? (v - min) / (max - min) : 0.5;
  scored.forEach((s) => {
    const p = prices.length ? norm(s.price, minP, maxP) : 0.5;
    const t = times.length ? norm(s.mins, minT, maxT) : 0.5;
    s.score = p * 0.5 + t * 0.5;
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].item;
}

function pick_arrival_transport(items, departure, destination) {
  if (!items.length) return null;
  const directional = items.filter((item) => transport_direction_matches(item, departure, destination));
  // 有明确去程方向时，在去程候选内综合性价比+时间选取；否则（如仅目的地查询）在全部交通中综合选取
  return pick_best_value_transport(directional.length ? directional : items);
}

function pick_return_transport(items, departure, destination, exclude) {
  if (!items.length) return null;
  const directional = items.filter((item) => item !== exclude && transport_direction_matches(item, destination, departure));
  return directional.length ? pick_best_value_transport(directional) : null;
}

function pick_hotel_for_day(hotelItems, dp, usedHotels) {
  if (!hotelItems || !hotelItems.length) return null;
  // 区县级关键词更精确（如“富阳区/桐庐”），城市级（“杭州”）过宽只作兜底
  const specific = [dp.county, ...(dp.activities || []).map((a) => a && a.countyName)].filter(Boolean);
  const broad = [dp.city, ...(dp.cityNameList || [])].filter(Boolean);
  const matchBy = (keywords, requireUnused) => hotelItems.find((h) =>
    (!requireUnused || !usedHotels.has(h)) && keywords.some((kw) => hotel_area_text(h).includes(kw)));
  return matchBy(specific, true)
    || matchBy(specific, false)
    || matchBy(broad, true)
    || pick_high_score_item(hotelItems.filter((h) => !usedHotels.has(h)))
    || hotelItems[0];
}

function hotel_area_text(item) {
  const raw = item.raw || {};
  return [raw.bdName, raw.countyName, raw.cityName, item.address, item.title].filter(Boolean).join(' ');
}

function day_area_label(dp) {
  const raw = (dp.activities || []).find((a) => a && (a.cityName || a.countyName)) || {};
  return join_non_empty([raw.cityName, raw.countyName], ' · ') || (dp.cityNameList || []).join(' · ') || '';
}

function format_transport_brief(item, from, to, kind) {
  const raw = item.raw || {};
  const no = raw.trainNo || raw.flightNo || raw.coachNo || String(item.title || '').split(' | ')[0] || '车次';
  const routeText = item.route || (from && to ? `${from} → ${to}` : '');
  const parts = [routeText, item.date, item.time, item.duration, item.price ? `${item.price}起` : ''].filter(Boolean);
  return `${no}（${parts.join('，')}）`;
}

function format_activity_brief(activity) {
  if (!activity) return '推荐景点';
  const tags = activity_tag_list(activity);
  return `${activity.name || '推荐景点'}${tags.length ? `（${tags.join('，')}）` : ''}`;
}

function activity_tag_list(activity) {
  const tags = [];
  if (activity.star) tags.push(String(activity.star));
  if (activity.score) tags.push(`评分${activity.score}`);
  const price = activity.price != null && activity.price !== '' ? String(activity.price).replace(/^¥/, '') : '';
  if (price && Number(price) > 0) tags.push(`¥${price}起`);
  else if (price === '0' || Number(price) === 0) tags.push('免费');
  if (activity.playTime) tags.push(`建议${activity.playTime}`);
  return tags;
}

function activity_reason(activity) {
  const text = activity.describe || activity.introduction || activity.theme || '';
  return text ? `${text}，` : '';
}

function parse_food_list(text) {
  const s = String(text || '').replace(/^.*?有[:：]/, '').replace(/[。.]\s*$/, '');
  return s.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);
}

function clean_summary_text(text) {
  return String(text || '').replace(/\s*Day\s*\d+\s*·?\s*/i, '').trim();
}

function numeric_or(text, fallback) {
  const m = String(text || '').match(/\d+/);
  return m ? Number(m[0]) : fallback;
}

function build_itinerary_highlight(days, destination, foods) {
  const spots = days.flatMap((d) => (d.activities || []).map((a) => a && a.name)).filter(Boolean);
  const uniqueSpots = Array.from(new Set(spots)).slice(0, 4);
  const spotText = uniqueSpots.length ? uniqueSpots.join('、') : `${destination}人气景点`;
  const foodText = foods.length ? `，穿插 ${foods.slice(0, 3).join('、')} 等本地味道` : '';
  return `${days.length} 天动线覆盖 ${spotText}${foodText}，松弛有度、老少皆宜。`;
}

function build_itinerary_tips(days, foods, arrivalTransport, returnTransport) {
  const tips = [];
  if (arrivalTransport) {
    tips.push('往返大交通建议尽早锁定：到达尽量安排上午/中午，返程按车次时间倒推退房与出发。');
  } else {
    tips.push('先确定往返车次/航班时间，再据此反推每天的游玩强度与住宿位置。');
  }
  tips.push('热门景点（动物园、湿地、演艺等）提前网上购票、错峰入园，避免现场排队。');
  tips.push('按“一天一个片区”就近安排住宿与景点，减少每天的往返通勤时间。');
  if (foods.length) {
    tips.push(`本地美食可重点尝试 ${foods.slice(0, 5).join('、')}，就近选择口碑餐厅。`);
  }
  tips.push('出行前留意天气与门票可订情况，预留 1 个机动/备选景点以便灵活替换。');
  return tips;
}

// ---------- 渲染：行程安排建议（Markdown / 纯文本 / HTML） ----------

function build_itinerary_markdown_lines(model) {
  const lines = [];
  model.days.forEach((day, idx) => {
    if (idx > 0) lines.push('');
    const head = `**📅 Day ${day.dayNo} · ${day.phaseLabel}｜${day.title}**`;
    lines.push(day.cityLabel ? `${head}　—　${day.cityLabel}` : head);
    day.segments.forEach((seg) => {
      lines.push(`- ${seg.icon} **${seg.label}**：${seg.text}`);
    });
  });
  return lines;
}

function render_itinerary_advice_text(model) {
  return model.days.map((day) => {
    const head = `Day ${day.dayNo}｜${day.phaseLabel}｜${day.title}`;
    const body = day.segments.map((seg) => `${seg.label}：${seg.text}`).join(' ');
    return `${head}：${body}`;
  }).join('\n');
}

function render_itinerary_advice_html(model) {
  const highlight = model.highlight
    ? `<p class="itin-highlight">${escape_html(model.highlight)}</p>`
    : '';
  const days = model.days.map(render_itinerary_day_html).join('');
  return `${highlight}<div class="itin-timeline">${days}</div>`;
}

function render_itinerary_day_html(day) {
  const segs = day.segments.map((seg) => `
    <li class="itin-seg itin-seg--${escape_attr(seg.tone)}">
      <span class="itin-seg-ic">${escape_html(seg.icon)}</span>
      <div class="itin-seg-body"><b>${escape_html(seg.label)}</b><p>${escape_html(seg.text)}</p></div>
    </li>`).join('');
  return `<article class="itin-day itin-day--${escape_attr(day.phase)}">
    <div class="itin-day-head">
      <div class="itin-day-badge"><span class="itin-day-no">D${day.dayNo}</span><span class="itin-day-phase">${escape_html(day.phaseLabel)}</span></div>
      <div class="itin-day-title"><h3>${escape_html(day.title)}</h3>${day.cityLabel ? `<span class="itin-day-city">📍 ${escape_html(day.cityLabel)}</span>` : ''}</div>
    </div>
    <ul class="itin-seg-list">${segs}</ul>
  </article>`;
}

// ---------- 渲染：攻略行程（行程规划师风格 HTML 攻略） ----------

function render_plan_guide_html(planItems, model) {
  if (!model || !Array.isArray(model.days) || model.days.length === 0) {
    return render_plan_inspiration_html(planItems);
  }
  return `<div class="guide">
    ${render_guide_cover_html(model)}
    <div class="guide-route">${model.days.map(render_guide_day_html).join('')}</div>
    ${render_guide_food_html(model.foods)}
    ${render_guide_tips_html(model.tips)}
  </div>`;
}

function render_guide_cover_html(model) {
  const metrics = [
    { value: model.dayCount, label: '天行程' },
    { value: model.nights, label: '晚住宿' },
    { value: model.spotCount, label: '个景点' }
  ];
  if (model.budget) metrics.push({ value: model.budget, label: '人均预算' });
  const metricHtml = metrics
    .filter((m) => m.value != null && String(m.value).trim() !== '')
    .map((m) => `<div class="guide-metric"><b>${escape_html(String(m.value))}</b><span>${escape_html(m.label)}</span></div>`)
    .join('');
  const routeTitle = `${model.route || model.destination} · ${model.dayCount} 天${model.nights ? ` ${model.nights} 晚` : ''}深度游`;
  return `<div class="guide-cover">
    <p class="guide-eyebrow">行程规划师 · 定制攻略指南</p>
    <h3 class="guide-title">${escape_html(routeTitle)}</h3>
    ${model.highlight ? `<p class="guide-sub">${escape_html(model.highlight)}</p>` : ''}
    <div class="guide-metrics">${metricHtml}</div>
  </div>`;
}

function render_guide_day_html(day) {
  const transport = day.segments.find((s) => s.key === 'transport' || s.key === 'back');
  const hotel = day.segments.find((s) => s.key === 'hotel');
  const tip = day.segments.find((s) => s.key === 'tip');
  const brief = join_non_empty([
    transport ? `${transport.icon} ${transport.text}` : '',
    hotel ? `${hotel.icon} ${hotel.text}` : ''
  ], '　');
  const stops = (day.activities || []).map(render_guide_stop_html).join('');
  return `<section class="guide-day guide-day--${escape_attr(day.phase)}">
    <div class="guide-day-rail"><span class="guide-day-no">Day ${day.dayNo}</span><span class="guide-day-line"></span></div>
    <div class="guide-day-body">
      <div class="guide-day-title">
        <h4>${escape_html(day.phaseLabel)}</h4>
        <span class="guide-day-main">${escape_html(day.title)}</span>
        ${day.cityLabel ? `<span class="guide-day-city">📍 ${escape_html(day.cityLabel)}</span>` : ''}
      </div>
      ${brief ? `<p class="guide-day-brief">${escape_html(brief)}</p>` : ''}
      <div class="guide-stops">${stops || '<p class="guide-empty">当日以自由活动 / 周边休闲为主。</p>'}</div>
      ${tip ? `<div class="guide-day-tip"><span>💡 贴士</span><p>${escape_html(tip.text)}</p></div>` : ''}
    </div>
  </section>`;
}

function render_guide_stop_html(activity) {
  const links = extract_links(activity);
  const image = activity.image
    ? `<img class="guide-stop-img" src="${escape_attr(normalize_https_url(activity.image))}" alt="" onerror="this.style.display='none'">`
    : `<div class="guide-stop-img guide-stop-img-empty">景点</div>`;
  const tags = activity_tag_list(activity);
  const meta = join_non_empty([
    activity.openTime ? `🕒 ${activity.openTime}` : '',
    activity.address ? `📍 ${activity.address}` : ''
  ], '　');
  const price = (() => {
    const p = activity.price != null && activity.price !== '' ? String(activity.price).replace(/^¥/, '') : '';
    if (p === '' ) return '';
    return Number(p) > 0 ? `¥${p}起` : '免费';
  })();
  return `<article class="guide-stop">
    ${image}
    <div class="guide-stop-body">
      <div class="guide-stop-top">
        <h5>${escape_html(activity.name || '推荐景点')}</h5>
        ${price ? `<span class="guide-stop-price">${escape_html(price)}</span>` : ''}
      </div>
      ${tags.length ? `<div class="guide-stop-tags">${tags.map((t) => `<span>${escape_html(t)}</span>`).join('')}</div>` : ''}
      ${(activity.describe || activity.introduction) ? `<p class="guide-stop-desc">${escape_html(activity.describe || activity.introduction)}</p>` : ''}
      ${meta ? `<p class="guide-stop-meta">${escape_html(meta)}</p>` : ''}
      <div class="actions">${render_plan_action_links(links)}${render_plan_qr_block(links, activity.name || '推荐景点')}</div>
    </div>
  </article>`;
}

function render_guide_food_html(foods) {
  if (!Array.isArray(foods) || foods.length === 0) return '';
  const chips = foods.map((f) => `<span class="guide-food-chip">${escape_html(f)}</span>`).join('');
  return `<div class="guide-food">
    <div class="guide-block-head"><h4>🍜 当地必尝美食</h4><span>边玩边吃，别错过这些味道</span></div>
    <div class="guide-food-chips">${chips}</div>
  </div>`;
}

function render_guide_tips_html(tips) {
  if (!Array.isArray(tips) || tips.length === 0) return '';
  const list = tips.map((t) => `<li>${escape_html(t)}</li>`).join('');
  return `<div class="guide-tips">
    <div class="guide-block-head"><h4>📌 行前贴士</h4><span>规划师的实用建议</span></div>
    <ul>${list}</ul>
  </div>`;
}

function flatten_group_items(groups, types) {
  return groups
    .filter((group) => types.includes(group.type))
    .flatMap((group) => group.items || []);
}

function unique_items_by_title(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item && (item.title || item.name);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function plan_activity_items(planItems) {
  return unique_items_by_title(planItems.flatMap((item) => plan_activities(item)));
}

function plan_activities(item) {
  const raw = item && item.raw ? item.raw : item;
  return Array.isArray(raw && raw.activitiyList) ? raw.activitiyList.filter(Boolean) : [];
}

function infer_trip_days(extra) {
  const text = String(extra || '');
  const digit = text.match(/(\d+)\s*天/);
  if (digit) {
    return Number(digit[1]);
  }
  const chinese = [
    ['一天', 1], ['一日', 1], ['两天', 2], ['二天', 2], ['两日', 2], ['二日', 2],
    ['三天', 3], ['三日', 3], ['四天', 4], ['五天', 5]
  ];
  const found = chinese.find(([word]) => text.includes(word));
  return found ? found[1] : 3;
}

function pick_itinerary_transport(items, request_params = {}) {
  const routeText = `${request_params.departure || ''} → ${request_params.destination || ''}`;
  return items.find((item) => item.route === routeText)
    || pick_shortest_duration_item(items)
    || pick_lowest_price_item(items)
    || items[0]
    || null;
}

function pick_itinerary_hotel(items) {
  return pick_high_score_item(items) || pick_lowest_price_item(items) || items[0] || null;
}

function format_spot_name(item) {
  if (!item) {
    return '目的地核心景点';
  }
  const title = item.title || item.name || item.summary || '推荐景点';
  const score = item.score ? score_text(item) : item.subtitle;
  const tags = [item.price ? `¥${String(item.price).replace(/^¥/, '')}` : '', score].filter(Boolean).slice(0, 2).join('，');
  return tags ? `${title}（${tags}）` : title;
}

function build_transport_advices(items) {
  const advices = [];
  const cheapest = pick_lowest_price_item(items);
  if (cheapest) {
    advices.push(`1. 价格优先可看 ${format_item_brief(cheapest)}，它是当前可比价格里较低的一档，适合对预算敏感的行程。`);
  }

  const shortest = pick_shortest_duration_item(items);
  if (shortest && shortest !== cheapest) {
    advices.push(`2. 时间效率优先可看 ${format_item_brief(shortest)}，耗时 ${shortest.duration || '较短'}，适合希望减少路上时间的安排。`);
  }

  const grouped = group_subgroups(items);
  const comprehensive = grouped.find((group) => /综合|推荐|优选/.test(group.title));
  const balanced = (comprehensive && comprehensive.items[0]) || pick_balanced_transport_item(items, cheapest, shortest);
  if (balanced && balanced !== cheapest && balanced !== shortest) {
    advices.push(`${advices.length + 1}. 综合体验可关注 ${format_item_brief(balanced)}，价格、时间和出发时段相对均衡，适合不想只按单一指标筛选的用户。`);
  }

  return advices.slice(0, 3);
}

function build_hotel_advices(items, request_params = {}) {
  const advices = [];
  const cheapest = pick_lowest_price_item(items);
  if (cheapest) {
    advices.push(`1. 性价比优先可看 ${format_hotel_brief(cheapest)}，价格在当前结果中更友好，适合控制住宿预算。`);
  }

  const highScore = pick_high_score_item(items);
  if (highScore && highScore !== cheapest) {
    advices.push(`2. 口碑优先可看 ${format_hotel_brief(highScore)}，评分和点评量更突出，适合更看重入住稳定性的选择。`);
  }

  const preference = String(request_params.extra || '');
  const alreadyRecommended = new Set([cheapest, highScore].filter(Boolean));
  const locationMatched = items.find((item) => {
    if (alreadyRecommended.has(item)) {
      return false;
    }
    const text = [item.title, item.subtitle, item.address, detail_value(item, '推荐理由'), detail_value(item, '特色')].join(' ');
    return /外滩|迪士尼|机场|地铁|亲子|五星|豪华|早餐|商圈/.test(preference) && contains_preference_keyword(text, preference);
  }) || items.find((item) => !alreadyRecommended.has(item) && (detail_value(item, '推荐理由') || detail_value(item, '特色') || item.address));
  if (locationMatched) {
    advices.push(`${advices.length + 1}. 位置和偏好匹配可关注 ${format_hotel_brief(locationMatched)}，${hotel_reason(locationMatched)}。`);
  }

  return advices.slice(0, 3);
}

function build_scenery_advices(items, request_params = {}) {
  const advices = [];
  const preference = `${request_params.destination || ''} ${request_params.extra || ''}`;
  const recommended = new Set();
  const familyPreferred = /亲子|孩子|带娃|儿童|家庭|一家|家人/.test(preference);

  const familyItem = familyPreferred
    ? items.find((item) => /亲子|孩子|儿童|家庭|乐园|动物|游乐|互动|主题/.test(scenery_search_text(item)))
    : null;
  if (familyItem) {
    recommended.add(familyItem);
    advices.push(`1. 亲子/家庭出游优先看 ${format_scenery_brief(familyItem)}，${scenery_reason(familyItem)}；这类景点互动性更强，适合把半天到一天的时间留给孩子体验。`);
  }

  const ranked = pick_ranked_scenery_item(items, recommended) || pick_high_score_item(items);
  if (ranked && !recommended.has(ranked)) {
    recommended.add(ranked);
    advices.push(`${advices.length + 1}. 口碑和榜单优先可看 ${format_scenery_brief(ranked)}，${scenery_reason(ranked)}；适合作为本次行程的重点景点。`);
  }

  const priceFriendly = pick_lowest_price_item(items);
  if (priceFriendly && !recommended.has(priceFriendly)) {
    recommended.add(priceFriendly);
    advices.push(`${advices.length + 1}. 预算友好或补位游玩可看 ${format_scenery_brief(priceFriendly)}，当前门票价格更容易控制成本，适合和附近景点串联安排。`);
  }

  const openTimeItem = items.find((item) => !recommended.has(item) && detail_value(item, '开放时间'));
  if (openTimeItem && advices.length < 3) {
    advices.push(`${advices.length + 1}. 时间安排上可关注 ${format_scenery_brief(openTimeItem)}，开放时间信息更完整，建议出发前按页面说明确认最晚入园和闭园时间。`);
  }

  if (!advices.length) {
    const names = items.slice(0, 3).map((item) => item.title).join('、');
    advices.push(`游玩建议可把 ${names} 作为重点备选，并结合开放时间、位置和门票价格安排顺序。`);
  }

  return advices.slice(0, 3);
}

function pick_ranked_scenery_item(items, excluded = new Set()) {
  return items
    .filter((item) => !excluded.has(item))
    .map((item) => ({ item, rank: scenery_rank_number(item), score: numeric_score(item.score || item.subtitle) }))
    .filter((entry) => entry.rank > 0 || entry.score > 0)
    .sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return b.score - a.score;
    })[0]?.item || null;
}

function scenery_rank_number(item) {
  const match = String(detail_value(item, '榜单') || item.subtitle || '').match(/No\.(\d+)|第\s*(\d+)/i);
  return match ? Number(match[1] || match[2]) : 0;
}

function scenery_search_text(item) {
  return [
    item.title,
    item.subtitle,
    item.address,
    detail_value(item, '商圈/景区'),
    detail_value(item, '榜单'),
    detail_value(item, '主题'),
    detail_value(item, '特色'),
    detail_value(item, '设施')
  ].join(' ');
}

function format_scenery_brief(item) {
  return `${item.title}${item.score ? `（${item.score}` : '（'}${item.price ? `，${item.price} 起` : ''}${detail_value(item, '榜单') ? `，${detail_value(item, '榜单')}` : ''}）`;
}

function scenery_reason(item) {
  return detail_value(item, '特色')
    || detail_value(item, '榜单')
    || detail_value(item, '商圈/景区')
    || item.subtitle
    || '景点信息较完整，便于结合门票和开放时间做决策';
}

function format_hotel_brief(item) {
  return `${item.title}${item.score ? `（${item.score}` : '（'}${item.price ? `，${item.price} 起` : ''}${item.address ? `，${item.address}` : ''}）`;
}

function contains_preference_keyword(text, preference) {
  const keywords = ['外滩', '迪士尼', '机场', '地铁', '亲子', '五星', '豪华', '早餐', '商圈'];
  return keywords.some((keyword) => preference.includes(keyword) && text.includes(keyword));
}

function hotel_reason(item) {
  return detail_value(item, '推荐理由') || detail_value(item, '特色') || item.address || '位置和酒店信息更贴合本次筛选条件';
}

function format_item_brief(item) {
  return `${item.title}${item.date ? `（${item.date}` : '（'}${item.time ? `${item.date ? '，' : ''}${item.time}` : ''}${item.duration ? `，${item.duration}` : ''}${item.price ? `，${item.price}` : ''}）`;
}

function pick_lowest_price_item(items) {
  return items
    .map((item) => ({ item, price: numeric_price(item.price) }))
    .filter((entry) => entry.price > 0)
    .sort((a, b) => a.price - b.price)[0]?.item || null;
}

function pick_shortest_duration_item(items) {
  return items
    .map((item) => ({ item, minutes: duration_minutes(item.duration), price: numeric_price(item.price) }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => a.minutes - b.minutes || a.price - b.price)[0]?.item || null;
}

function pick_balanced_transport_item(items, cheapest, shortest) {
  return items.find((item) => item !== cheapest && item !== shortest) || null;
}

function pick_high_score_item(items) {
  return items
    .map((item) => ({ item, score: numeric_score(item.score || item.subtitle) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

function numeric_price(value) {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function numeric_score(value) {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function duration_minutes(value) {
  const text = String(value || '');
  const hour = text.match(/(\d+)\s*(?:时|小时|h)/i);
  const minute = text.match(/(\d+)\s*(?:分|分钟|m)/i);
  if (!hour && !minute) {
    return 0;
  }
  return (hour ? Number(hour[1]) * 60 : 0) + (minute ? Number(minute[1]) : 0);
}

async function enrich_qr_data_uris(items, options) {
  const fetcher = options.fetch_image_as_data_uri || fetch_image_as_data_uri;
  const targets = items.filter((item) => item.links && item.links.qrImageUrl);
  await Promise.all(targets.map(async (item) => {
    try {
      item.links.qrDataUri = await fetcher(item.links.qrImageUrl);
    } catch (_) {
      item.links.qrDataUri = '';
    }
  }));
}

async function enrich_plan_activity_qr_data_uris(items, options) {
  const fetcher = options.fetch_image_as_data_uri || fetch_image_as_data_uri;
  const activities = items
    .filter((item) => item.type === 'plan')
    .flatMap((item) => plan_activities(item));
  const targets = activities.filter((activity) => activity && activity.workbuddyLinks && activity.workbuddyLinks.qrImageUrl);
  await Promise.all(targets.map(async (activity) => {
    try {
      activity.workbuddyLinks.qrDataUri = await fetcher(normalize_https_url(activity.workbuddyLinks.qrImageUrl));
    } catch (_) {
      activity.workbuddyLinks.qrDataUri = '';
    }
  }));
}

function write_html_file(title, items, request_params, stats, advice, options = {}, itineraryModel = null) {
  const base_dir = normalize_workbuddy_output_dir(options.output_dir
    || process.env.CHENGXIN_WORKBUDDY_OUTPUT_DIR
    || path.join(process.cwd(), 'outputs'));
  const topic = sanitize_file_name(infer_file_topic(title, items, request_params)) || '同程旅行查询结果';
  const timestamp = format_timestamp(new Date());
  const output_dir = path.join(base_dir, `${timestamp}-${topic}`);
  fs.mkdirSync(output_dir, { recursive: true });

  const htmlFileName = unique_file_name(output_dir, `${topic}.html`);
  const htmlFilePath = path.join(output_dir, htmlFileName);
  const html = build_full_html(title, items, request_params, stats, advice, itineraryModel);
  fs.writeFileSync(htmlFilePath, html, 'utf8');
  return { htmlFilePath, htmlFileName };
}

function normalize_workbuddy_output_dir(value, platform = process.platform) {
  const raw = String(value || '').trim();
  if (!raw || platform !== 'win32') {
    return raw;
  }

  const cygwinMatch = raw.match(/^[/\\](?:cygdrive|mnt)[/\\]([a-zA-Z])(?:[/\\](.*))?$/);
  if (cygwinMatch) {
    const rest = cygwinMatch[2] ? cygwinMatch[2].replace(/[\\/]+/g, '\\') : '';
    return `${cygwinMatch[1].toUpperCase()}:\\${rest}`;
  }

  const msysMatch = raw.match(/^[/\\]([a-zA-Z])(?:[/\\](.*))?$/);
  if (msysMatch) {
    const rest = msysMatch[2] ? msysMatch[2].replace(/[\\/]+/g, '\\') : '';
    return `${msysMatch[1].toUpperCase()}:\\${rest}`;
  }

  const driveMatch = raw.match(/^([a-zA-Z]):[/\\](.*)$/);
  if (driveMatch) {
    return `${driveMatch[1].toUpperCase()}:\\${driveMatch[2].replace(/[\\/]+/g, '\\')}`;
  }

  return raw;
}

function build_full_html(title, items, request_params, stats, advice, itineraryModel = null) {
  const groups = group_items_by_type(items);
  const itineraryMode = is_itinerary_request(items, request_params);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape_html(title)}</title>
  <style>${build_css()}</style>
</head>
<body>
  <header class="topbar">
    <div class="brand">${LOGO_DATA_URI ? `<img class="brand-logo" src="${LOGO_DATA_URI}" alt="同程旅行">` : '<span class="brand-mark"></span><span>同程旅行</span>'}</div>
    <div class="subtitle">WorkBuddy 查询结果</div>
  </header>
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">Tongcheng Travel</p>
        <h1>${escape_html(title)}</h1>
        <p class="hero-copy">共 ${stats.total} 条结果。下方按接口返回的推荐分组完整展示，PC 端可直接预订，手机端可使用微信扫描二维码打开。</p>
      </div>
    </section>
    <section class="querybar">
      ${render_query_chip('出发地', request_params.departure)}
      ${render_query_chip('目的地', request_params.destination)}
      ${render_query_chip('补充需求', request_params.extra)}
    </section>
    <section class="advice${itineraryMode ? ' itinerary-advice' : ''}">
      <h2>${itineraryMode ? '🧭 行程安排建议' : '推荐建议'}</h2>
      ${itineraryModel ? render_itinerary_advice_html(itineraryModel) : render_advice_html(advice)}
    </section>
    ${groups.map((group) => render_group_html(group, itineraryModel)).join('\n')}
    <section class="support">
      <h2>客服支持</h2>
      <p>使用过程中遇到问题?同程旅行提供 7×24 小时服务:</p>
      <div class="support-actions">
        <span>📞 旅行者热线:95711</span>
        <a href="https://www.ly.com/public/newhelp/CustomerService.html" target="_blank" rel="noopener">💬 在线客服</a>
      </div>
    </section>
  </main>
  <div class="modal" id="qrModal" aria-hidden="true">
    <button class="modal-close" type="button" onclick="closeQrModal()">关闭</button>
    <div class="modal-card">
      <img id="qrModalImg" src="" alt="微信扫码二维码">
      <p id="qrModalTitle">微信扫码打开同程旅行小程序</p>
    </div>
  </div>
  <script>${build_js()}</script>
</body>
</html>`;
}

function render_query_chip(label, value) {
  if (value == null || String(value).trim() === '') {
    return '';
  }
  return `<div class="query-chip"><span>${escape_html(label)}</span><strong>${escape_html(value)}</strong></div>`;
}

function render_advice_html(advice) {
  const lines = String(advice || '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.some((line) => /^Day\s*\d+｜/.test(line))) {
    return `<div class="itinerary-steps">${lines.map(render_itinerary_step_html).join('')}</div>`;
  }
  if (lines.length <= 1) {
    return `<p>${escape_html(lines[0] || '')}</p>`;
  }
  return `<ol>${lines.map((line) => `<li>${escape_html(line.replace(/^\d+\.\s*/, ''))}</li>`).join('')}</ol>`;
}

function render_itinerary_step_html(line) {
  const match = line.match(/^(Day\s*\d+｜[^：:]+)[：:](.*)$/);
  const title = match ? match[1] : line;
  const body = match ? match[2].trim() : '';
  return `<article class="itinerary-step">
    <span>${escape_html(title.replace(/^Day\s*/, 'D'))}</span>
    <p>${escape_html(body || title)}</p>
  </article>`;
}

function render_group_html(group, itineraryModel = null) {
  // 攻略行程分组：使用行程规划师风格的攻略指南，隐藏机械的“N 条”计数
  if (group.type === 'plan') {
    return `<section class="result-group plan-group">
      <div class="group-head plan-group-head"><h2>${escape_html(icon_for_type(group.type))} ${escape_html(group.label)}</h2></div>
      ${render_group_body(group, itineraryModel)}
    </section>`;
  }
  return `<section class="result-group">
    <div class="group-head"><h2>${escape_html(icon_for_type(group.type))} ${escape_html(group.label)}</h2><span>${group.items.length} 条</span></div>
    ${render_group_body(group, itineraryModel)}
  </section>`;
}

function render_group_body(group, itineraryModel = null) {
  if (group.type === 'train' || group.type === 'flight' || group.type === 'bus') {
    return group_subgroups(group.items).map((subgroup) => {
      const title = subgroup.title ? `<h3 class="subgroup-title">${escape_html(subgroup.title)}<span>${subgroup.items.length} 条</span></h3>` : '';
      return `${title}${render_transport_table(subgroup.items)}`;
    }).join('\n');
  }
  if (group.type === 'hotel') {
    return render_hotel_views(group.items);
  }
  if (group.type === 'scenery') {
    return render_scenery_views(group.items);
  }
  if (group.type === 'plan') {
    return render_plan_guide_html(group.items, itineraryModel);
  }
  return `<div class="cards">${group.items.map(render_card_html).join('\n')}</div>`;
}

function render_plan_inspiration_html(items) {
  const food = detail_value(items[0] || {}, '美食');
  const summary = render_plan_summary_html(items[0]);
  return `${summary}
  <div class="plan-guide">${items.map(render_plan_day_html).join('\n')}</div>
  ${food ? `<div class="food-guide"><h3>杭州味道</h3><p>${escape_html(food)}</p></div>` : ''}`;
}

function render_plan_summary_html(item) {
  if (!item) {
    return '';
  }
  const chips = [
    detail_value(item, '天数'),
    detail_value(item, '住宿'),
    detail_value(item, '景点数'),
    detail_value(item, '预算')
  ].filter(Boolean);
  const feature = detail_value(item, '特色');
  if (!chips.length && !feature) {
    return '';
  }
  return `<div class="plan-summary">
    ${chips.map((chip) => `<span>${escape_html(chip)}</span>`).join('')}
    ${feature ? `<p>${escape_html(feature)}</p>` : ''}
  </div>`;
}

function render_plan_day_html(item, index) {
  const activities = plan_activities(item);
  return `<article class="plan-day-card">
    <div class="plan-day-head">
      <span>${escape_html(`Day ${item.raw.index || index + 1}`)}</span>
      <h3>${escape_html(item.title)}</h3>
      ${item.subtitle ? `<p>${escape_html(item.subtitle)}</p>` : ''}
    </div>
    <div class="plan-activity-list">${activities.map(render_plan_activity_html).join('')}</div>
  </article>`;
}

function render_plan_activity_html(activity) {
  const links = extract_links(activity);
  const image = activity.image
    ? `<img src="${escape_attr(normalize_https_url(activity.image))}" alt="" onerror="this.style.display='none'">`
    : `<div class="plan-activity-empty">景点</div>`;
  const meta = join_non_empty([
    activity.cityName,
    activity.countyName,
    score_text(activity),
    activity.price ? `¥${activity.price}起` : ''
  ], ' · ');
  const time = join_non_empty([
    activity.openTime ? `开放 ${activity.openTime}` : '',
    activity.playTime ? `建议 ${activity.playTime}` : ''
  ], ' · ');
  return `<section class="plan-activity">
    ${image}
    <div class="plan-activity-main">
      <h4>${escape_html(activity.name || '推荐景点')}</h4>
      ${meta ? `<p class="subtitle-line">${escape_html(meta)}</p>` : ''}
      ${(activity.describe || activity.introduction) ? `<p class="desc">${escape_html(activity.describe || activity.introduction)}</p>` : ''}
      ${activity.address ? `<p class="plan-address">📍 ${escape_html(activity.address)}</p>` : ''}
      ${time ? `<p class="plan-time">🕒 ${escape_html(time)}</p>` : ''}
      <div class="actions">${render_plan_action_links(links)}${render_plan_qr_block(links, activity.name || '推荐景点')}</div>
    </div>
  </section>`;
}

function render_plan_action_links(links) {
  return links.pcUrl
    ? `<a class="btn btn-primary" href="${escape_attr(links.pcUrl)}" target="_blank" rel="noopener">PC 端预订</a>`
    : '';
}

function render_plan_qr_block(links, title) {
  const qrSrc = links.qrDataUri || links.qrImageUrl || '';
  if (qrSrc) {
    return `<div class="qr-wrap"><button class="btn btn-ghost qr-trigger" type="button" data-qr="${escape_attr(qrSrc)}" data-title="${escape_attr(title)}" onclick="openQrModal(this)">手机扫码</button>
       <div class="qr-pop"><img src="${escape_attr(qrSrc)}" alt="二维码"><p>微信扫一扫</p></div></div>`;
  }
  if (links.qrWrapperUrl) {
    return `<a class="btn btn-ghost" href="${escape_attr(links.qrWrapperUrl)}" target="_blank" rel="noopener">手机扫码</a>`;
  }
  return '';
}

function render_hotel_views(items) {
  return `<div class="view-switch" data-view-switch>
    <button class="view-btn" type="button" onclick="switchHotelView(this,'grid')">卡片</button>
    <button class="view-btn is-active" type="button" onclick="switchHotelView(this,'list')">列表</button>
  </div>
  <div class="hotel-view hotel-view-grid" data-view="grid">
    <div class="hotel-grid">${items.map(render_hotel_card_html).join('\n')}</div>
  </div>
  <div class="hotel-view hotel-view-list is-active" data-view="list">
    <div class="hotel-list">${items.map(render_hotel_list_item_html).join('\n')}</div>
  </div>`;
}

function render_scenery_views(items) {
  return `<div class="view-switch" data-view-switch>
    <button class="view-btn" type="button" onclick="switchSceneryView(this,'grid')">卡片</button>
    <button class="view-btn is-active" type="button" onclick="switchSceneryView(this,'list')">列表</button>
  </div>
  <div class="scenery-view scenery-view-grid" data-view="grid">
    <div class="scenery-grid">${items.map(render_scenery_card_html).join('\n')}</div>
  </div>
  <div class="scenery-view scenery-view-list is-active" data-view="list">
    <div class="scenery-list">${items.map(render_scenery_list_item_html).join('\n')}</div>
  </div>`;
}

function render_transport_table(items) {
  const rows = items.map((item) => {
    const qrBlock = render_qr_block(item);
    return `<tr>
      <td>${render_transport_title(item)}</td>
      <td>${escape_html(item.route || '-')}</td>
      <td>${escape_html(item.date || '-')}</td>
      <td>${escape_html(item.time || '-')}</td>
      <td>${escape_html(item.duration || '-')}</td>
      <td>${escape_html(price_or_ticket(item))}</td>
      <td><div class="actions table-actions">${render_action_links(item)}${qrBlock}</div></td>
    </tr>`;
  }).join('\n');
  return `<div class="table-wrap"><table class="result-table">
    <thead><tr><th>班次/名称</th><th>出发到达</th><th>日期</th><th>时间</th><th>时长</th><th>价格/席别</th><th>预订</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function render_transport_title(item) {
  const logo = item.logo
    ? `<img class="airline-logo" src="${escape_attr(item.logo)}" alt="" onerror="this.style.display='none'">`
    : '';
  return `<div class="transport-title">${logo}<strong>${escape_html(item.title)}</strong></div>`;
}

function render_hotel_card_html(item) {
  const image = item.image
    ? `<img class="hotel-img" src="${escape_attr(item.image)}" alt="" onerror="this.style.display='none'">`
    : `<div class="hotel-img hotel-img-empty">酒店</div>`;
  return `<article class="hotel-card">
    ${image}
    <div class="hotel-body">
      <div class="card-title-row">
        <h3>${escape_html(item.title)}</h3>
        ${item.price ? `<div class="price">${escape_html(item.price)}<small>起/晚</small></div>` : ''}
      </div>
      <p class="subtitle-line">${escape_html(item.subtitle || '')}</p>
      <div class="tags">${item.tags.map((tag) => `<span>${escape_html(tag)}</span>`).join('')}</div>
      <p class="desc">${escape_html(join_non_empty([detail_value(item, '推荐理由'), detail_value(item, '特色')], '；'))}</p>
      <div class="actions">${render_action_links(item)}${render_qr_block(item)}</div>
    </div>
  </article>`;
}

function render_hotel_list_item_html(item) {
  const image = item.image
    ? `<img class="hotel-list-img" src="${escape_attr(item.image)}" alt="" onerror="this.style.display='none'">`
    : `<div class="hotel-list-img hotel-img-empty">酒店</div>`;
  const score = item.score || detail_value(item, '评分') || '';
  const reason = join_non_empty([detail_value(item, '推荐理由'), detail_value(item, '特色')], '；');
  return `<article class="hotel-list-item">
    ${image}
    <div class="hotel-list-main">
      <div class="hotel-list-title">
        <h3>${escape_html(item.title)}</h3>
        ${item.tags[0] ? `<span>${escape_html(item.tags[0])}</span>` : ''}
      </div>
      <p class="subtitle-line">${escape_html(join_non_empty([score, item.address], ' · ') || item.subtitle || '')}</p>
      <div class="tags">${item.tags.slice(0, 5).map((tag) => `<span>${escape_html(tag)}</span>`).join('')}</div>
      ${reason ? `<p class="desc">${escape_html(reason)}</p>` : ''}
    </div>
    <div class="hotel-list-side">
      ${item.price ? `<div class="price">${escape_html(item.price)}<small>起/晚</small></div>` : ''}
      <div class="actions">${render_action_links(item)}${render_qr_block(item)}</div>
    </div>
  </article>`;
}

function render_scenery_card_html(item) {
  const image = item.image
    ? `<img class="scenery-img" src="${escape_attr(item.image)}" alt="" onerror="this.style.display='none'">`
    : `<div class="scenery-img scenery-img-empty">景点</div>`;
  const feature = detail_value(item, '特色');
  const openTime = detail_value(item, '开放时间');
  const location = scenery_display_location(item);
  const district = detail_value(item, '商圈/景区');
  return `<article class="scenery-card">
    ${image}
    <div class="scenery-body">
      <div class="card-title-row">
        <h3>${escape_html(item.title)}</h3>
        ${item.price ? `<div class="price">${escape_html(item.price)}<small>起</small></div>` : ''}
      </div>
      <p class="subtitle-line">${escape_html(item.subtitle || '')}</p>
      <div class="tags">${item.tags.map((tag) => `<span>${escape_html(tag)}</span>`).join('')}</div>
      ${feature ? `<p class="desc">${escape_html(feature)}</p>` : ''}
      <div class="scenery-info">
        ${render_scenery_info('区域', location)}
        ${render_scenery_info('景区/商圈', district)}
        ${render_scenery_info('开放时间', openTime, 'wide')}
      </div>
      <div class="actions">${render_action_links(item)}${render_qr_block(item)}</div>
    </div>
  </article>`;
}

function render_scenery_list_item_html(item) {
  const image = item.image
    ? `<img class="scenery-list-img" src="${escape_attr(item.image)}" alt="" onerror="this.style.display='none'">`
    : `<div class="scenery-list-img scenery-img-empty">景点</div>`;
  const feature = detail_value(item, '特色');
  const location = scenery_display_location(item);
  const district = detail_value(item, '商圈/景区');
  const openTime = detail_value(item, '开放时间');
  return `<article class="scenery-list-item">
    ${image}
    <div class="scenery-list-main">
      <div class="hotel-list-title">
        <h3>${escape_html(item.title)}</h3>
        ${detail_value(item, '等级') ? `<span>${escape_html(detail_value(item, '等级'))}</span>` : ''}
      </div>
      <p class="subtitle-line">${escape_html(join_non_empty([item.score, detail_value(item, '榜单')], ' · ') || item.subtitle || '')}</p>
      <div class="tags">${item.tags.slice(0, 6).map((tag) => `<span>${escape_html(tag)}</span>`).join('')}</div>
      ${feature ? `<p class="desc">${escape_html(feature)}</p>` : ''}
      <ul class="scenery-list-details">
        ${location ? `<li><span>区域</span><strong>${escape_html(location)}</strong></li>` : ''}
        ${district ? `<li><span>景区/商圈</span><strong>${escape_html(district)}</strong></li>` : ''}
        ${openTime ? `<li><span>开放</span><strong>${escape_html(openTime)}</strong></li>` : ''}
      </ul>
    </div>
    <div class="hotel-list-side">
      ${item.price ? `<div class="price">${escape_html(item.price)}<small>起</small></div>` : ''}
      <div class="actions">${render_action_links(item)}${render_qr_block(item)}</div>
    </div>
  </article>`;
}

function scenery_display_location(item) {
  return detail_value(item, '城市区域') || String(item.subtitle || '').split(' · ')[0] || '';
}

function render_scenery_info(label, value, extraClass = '') {
  if (value == null || String(value).trim() === '') {
    return '';
  }
  const className = extraClass ? ` class="${escape_attr(extraClass)}"` : '';
  return `<div${className}><span>${escape_html(label)}</span><strong>${escape_html(value)}</strong></div>`;
}

function render_action_links(item) {
  const pc = item.links.pcUrl
    ? `<a class="btn btn-primary" href="${escape_attr(item.links.pcUrl)}" target="_blank" rel="noopener">PC 端预订</a>`
    : '';
  return pc;
}

function render_qr_block(item) {
  const qrSrc = item.links.qrDataUri || item.links.qrImageUrl || '';
  if (qrSrc) {
    return `<div class="qr-wrap"><button class="btn btn-ghost qr-trigger" type="button" data-qr="${escape_attr(qrSrc)}" data-title="${escape_attr(item.title)}" onclick="openQrModal(this)">手机扫码</button>
       <div class="qr-pop"><img src="${escape_attr(qrSrc)}" alt="二维码"><p>微信扫一扫</p></div></div>`;
  }
  if (item.links.qrWrapperUrl) {
    return `<a class="btn btn-ghost" href="${escape_attr(item.links.qrWrapperUrl)}" target="_blank" rel="noopener">手机扫码</a>`;
  }
  return '';
}

function render_card_html(item, index) {
  const image = item.image
    ? `<img class="thumb" src="${escape_attr(item.image)}" alt="" onerror="this.style.display='none'">`
    : `<div class="thumb thumb-empty">${escape_html(item.label)}</div>`;
  const tags = item.tags.map((tag) => `<span>${escape_html(tag)}</span>`).join('');
  const details = item.details.slice(0, 6)
    .map((detail) => `<li><span>${escape_html(detail.label)}</span><strong>${escape_html(detail.value)}</strong></li>`)
    .join('');
  return `<article class="card card-${escape_attr(item.type)}">
    ${image}
    <div class="card-main">
      <div class="card-title-row">
        <div>
          <p class="type">${escape_html(item.label)} ${index ? '' : ''}</p>
          <h3>${escape_html(item.title)}</h3>
        </div>
        ${item.price ? `<div class="price">${escape_html(item.price)}<small>起</small></div>` : ''}
      </div>
      ${item.subtitle ? `<p class="subtitle-line">${escape_html(item.subtitle)}</p>` : ''}
      <div class="meta-line">
        ${item.route ? `<span>${escape_html(item.route)}</span>` : ''}
        ${item.time ? `<span>${escape_html(item.time)}</span>` : ''}
        ${item.duration ? `<span>${escape_html(item.duration)}</span>` : ''}
      </div>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${details ? `<ul class="details">${details}</ul>` : ''}
      <div class="actions">${render_action_links(item)}${render_qr_block(item)}</div>
    </div>
  </article>`;
}

function build_css() {
  return `
:root{--tc-green:#22b35f;--tc-green-dark:#15904a;--tc-purple:#5b2bbd;--tc-orange:#f05a28;--text:#172033;--muted:#6b7280;--line:#e7ebef;--bg:#f5f7f8;--card:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.5}
.topbar{height:64px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 32px;position:sticky;top:0;z-index:10}
.brand{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:800;color:var(--tc-purple)}.brand-logo{height:34px;width:auto;display:block}.brand-mark{width:34px;height:18px;border-radius:50%;background:linear-gradient(135deg,var(--tc-purple),#20105a);display:inline-block;position:relative}.brand-mark:after{content:"";position:absolute;right:-7px;top:-5px;width:13px;height:13px;border-radius:50%;background:#f7d800}.subtitle{color:var(--muted);font-size:13px}
.page{max-width:1180px;margin:0 auto;padding:26px 22px 48px}.hero{background:linear-gradient(135deg,#fff 0%,#f0fff6 100%);border:1px solid var(--line);border-radius:12px;padding:24px}.eyebrow{margin:0 0 6px;color:var(--tc-green-dark);font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase}.hero h1{margin:0;font-size:28px;line-height:1.25}.hero-copy{margin:10px 0 0;color:var(--muted);max-width:760px}
.querybar{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.query-chip{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 12px}.query-chip span{display:block;font-size:12px;color:var(--muted)}.query-chip strong{font-size:14px}
.advice,.support{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px;margin:18px 0}.advice h2,.support h2{margin:0 0 10px;font-size:20px}.advice p,.support p{margin:6px 0;color:#3f4b5f}.advice ol{display:grid;gap:10px;margin:10px 0 0;padding:0;counter-reset:advice}.advice li{list-style:none;position:relative;margin:0;padding:11px 14px 11px 46px;background:#f7fff9;border:1px solid #d6eadf;border-radius:9px;color:#253047}.advice li:before{counter-increment:advice;content:counter(advice);position:absolute;left:14px;top:11px;width:22px;height:22px;border-radius:50%;background:var(--tc-green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}.itinerary-advice{background:linear-gradient(135deg,#fff 0%,#f7fff9 100%);border-color:#cfe9da}.itinerary-steps{display:grid;grid-template-columns:1fr;gap:12px;margin-top:10px}.itinerary-step{background:#fff;border:1px solid #d6eadf;border-radius:10px;padding:15px 16px;box-shadow:0 8px 22px rgba(23,32,51,.04);display:grid;grid-template-columns:118px minmax(0,1fr);gap:14px;align-items:start}.itinerary-step span{display:inline-flex;background:var(--tc-green);color:#fff;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;justify-content:center}.itinerary-step p{margin:0;color:#253047}.support a{color:var(--tc-green-dark);text-decoration:none;font-weight:700}.support-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}.support-actions span,.support-actions a{background:#f7fff9;border:1px solid #d6eadf;border-radius:8px;padding:8px 12px;color:#253047}
.result-group{margin-top:22px}.group-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.group-head h2{margin:0;font-size:22px}.group-head span{color:var(--muted);font-size:13px}.subgroup-title{display:flex;align-items:center;gap:8px;margin:16px 0 8px;font-size:17px;color:#253047}.subgroup-title span{font-size:12px;color:var(--muted);font-weight:500}.cards{display:grid;gap:14px}
.table-wrap{background:#fff;border:1px solid var(--line);border-radius:10px;overflow-x:auto;overflow-y:visible;margin-bottom:12px}.result-table{width:100%;border-collapse:collapse;min-width:980px}.result-table th{background:#f7f8fa;text-align:left;padding:12px;color:#253047;font-weight:700}.result-table td{padding:13px 12px;border-top:1px solid var(--line);vertical-align:middle}.result-table .actions,.result-table td:last-child{white-space:nowrap}.result-table td:first-child{min-width:180px}.result-table td:last-child{width:190px}.transport-title{display:flex;align-items:center;gap:9px;min-width:0}.airline-logo{width:26px;height:26px;border-radius:50%;object-fit:contain;background:#f7f8fa;border:1px solid var(--line);flex:0 0 auto}.transport-title strong{line-height:1.35}
.view-switch{display:flex;justify-content:flex-end;gap:8px;margin:-4px 0 12px}.view-btn{border:1px solid var(--line);background:#fff;color:#253047;border-radius:7px;padding:7px 12px;font-weight:700;cursor:pointer}.view-btn.is-active{background:var(--tc-green);border-color:var(--tc-green);color:#fff}.hotel-view,.scenery-view{display:none}.hotel-view.is-active,.scenery-view.is-active{display:block}
.hotel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:16px}.hotel-card{position:relative;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:visible;display:grid;grid-template-columns:minmax(170px,34%) minmax(0,1fr);min-height:214px}.hotel-img{width:100%;height:100%;min-height:190px;object-fit:cover;background:#eef2f5;border-radius:10px 0 0 10px;align-self:stretch}.hotel-img-empty{display:flex;align-items:center;justify-content:center;color:var(--tc-green-dark);font-weight:700}.hotel-body{padding:18px;min-width:0}.desc{color:#3f4b5f;margin:10px 0 0}
.hotel-list{display:grid;gap:14px}.hotel-list-item{position:relative;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;grid-template-columns:164px minmax(0,1fr) 180px;gap:16px;align-items:center;overflow:visible}.hotel-list-img{width:100%;height:164px;border-radius:8px;object-fit:cover;background:#eef2f5}.hotel-list-main{min-width:0;overflow-wrap:anywhere}.hotel-list-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.hotel-list-title h3{margin:0;font-size:20px;line-height:1.35}.hotel-list-title span{background:#f1f5f4;color:#5b6472;border-radius:4px;padding:2px 6px;font-size:12px}.hotel-list-side{display:grid;justify-items:end;gap:14px}
.scenery-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:16px}.scenery-card{position:relative;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:visible;display:grid;grid-template-rows:auto 1fr}.scenery-img{width:100%;height:210px;object-fit:cover;background:#eef2f5;border-radius:10px 10px 0 0}.scenery-img-empty{display:flex;align-items:center;justify-content:center;color:var(--tc-green-dark);font-weight:700}.scenery-body{padding:18px;min-width:0}.scenery-body h3{margin:0;font-size:20px;line-height:1.35}.scenery-info{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.scenery-info div{background:#f7f8fa;border:1px solid #edf0f2;border-radius:8px;padding:8px;min-width:0}.scenery-info div.wide{grid-column:1/-1}.scenery-info span{display:block;color:var(--muted);font-size:12px}.scenery-info strong{display:block;margin-top:2px;color:#253047;font-size:13px;font-weight:600;white-space:pre-line;overflow-wrap:anywhere}.scenery-list{display:grid;gap:14px}.scenery-list-item{position:relative;background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;grid-template-columns:190px minmax(0,1fr) 180px;gap:16px;align-items:center;overflow:visible}.scenery-list-img{width:100%;height:152px;border-radius:8px;object-fit:cover;background:#eef2f5}.scenery-list-main{min-width:0;overflow-wrap:anywhere}.scenery-list-details{display:grid;gap:6px;list-style:none;margin:10px 0 0;padding:0}.scenery-list-details li{font-size:13px;color:var(--muted)}.scenery-list-details span{margin-right:8px}.scenery-list-details strong{color:#253047;font-weight:600;white-space:pre-line}
.plan-summary{display:flex;flex-wrap:wrap;gap:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:14px}.plan-summary span{background:#f7fff9;border:1px solid #d6eadf;color:var(--tc-green-dark);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800}.plan-summary p{flex-basis:100%;margin:4px 0 0;color:#3f4b5f}.plan-guide{display:grid;gap:16px}.plan-day-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}.plan-day-head span{display:inline-flex;background:var(--tc-green);color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800}.plan-day-head h3{margin:10px 0 4px;font-size:22px}.plan-day-head p{margin:0 0 12px;color:#3f4b5f}.plan-activity-list{display:grid;gap:12px}.plan-activity{display:grid;grid-template-columns:180px minmax(0,1fr);gap:14px;background:#f7f8fa;border:1px solid #edf0f2;border-radius:10px;padding:12px}.plan-activity img,.plan-activity-empty{width:180px;height:132px;border-radius:8px;object-fit:cover;background:#eef2f5}.plan-activity-empty{display:flex;align-items:center;justify-content:center;color:var(--tc-green-dark);font-weight:800}.plan-activity-main{min-width:0}.plan-activity-main h4{margin:0;font-size:19px}.plan-address,.plan-time{margin:7px 0 0;color:#3f4b5f;font-size:13px}.food-guide{margin-top:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px}.food-guide h3{margin:0 0 6px;font-size:18px;color:#9a3412}.food-guide p{margin:0;color:#3f4b5f}
/* 行程安排建议 - 时间轴（itinerary） */
.itin-highlight{margin:0 0 16px;padding:13px 16px;background:linear-gradient(135deg,#f0fff6,#e3f9ec);border:1px solid #c6e9d5;border-radius:12px;color:#15603a;font-weight:600;line-height:1.6}
.itin-timeline{display:grid;gap:16px}
.itin-day{position:relative;background:#fff;border:1px solid var(--line);border-left:5px solid var(--tc-green);border-radius:14px;padding:16px 18px;box-shadow:0 10px 26px rgba(23,32,51,.05)}
.itin-day--arrival{border-left-color:#f59e0b}.itin-day--core{border-left-color:#22b35f}.itin-day--depart{border-left-color:#5b2bbd}
.itin-day-head{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:6px}
.itin-day-badge{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:82px;padding:9px 12px;border-radius:12px;background:linear-gradient(135deg,#e9f9ef,#d6f0e0);color:#15904a}
.itin-day--arrival .itin-day-badge{background:linear-gradient(135deg,#fff2dc,#ffe6bd);color:#b45309}.itin-day--depart .itin-day-badge{background:linear-gradient(135deg,#efeaff,#e2daff);color:#5b2bbd}
.itin-day-no{font-size:20px;font-weight:800;line-height:1}.itin-day-phase{font-size:11px;font-weight:700;margin-top:3px;letter-spacing:.02em}
.itin-day-title h3{margin:0;font-size:19px}.itin-day-city{color:var(--muted);font-size:13px}
.itin-seg-list{list-style:none;margin:10px 0 0;padding:0}
.itin-timeline .itin-seg{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;margin:0;padding:11px 0;background:none;border:0;border-top:1px dashed #eef1f4;border-radius:0}
.itin-timeline .itin-seg:before{content:none;display:none}
.itin-timeline .itin-seg:first-child{border-top:0}
.itin-seg-ic{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;background:#f1f5f9}
.itin-seg--transport .itin-seg-ic{background:#e6f0ff}.itin-seg--hotel .itin-seg-ic{background:#f1ebff}.itin-seg--day .itin-seg-ic{background:#e7f8ee}.itin-seg--night .itin-seg-ic{background:#eae7ff}.itin-seg--food .itin-seg-ic{background:#fff0e3}.itin-seg--tip .itin-seg-ic{background:#e4f6f2}
.itin-seg-body{min-width:0}.itin-seg-body b{color:#172033;font-size:14px}.itin-seg-body p{margin:2px 0 0;color:#3f4b5f;line-height:1.6}
/* 攻略行程 - 规划师攻略指南（guide） */
.guide{display:grid;gap:20px}
.guide-cover{position:relative;overflow:hidden;background:linear-gradient(135deg,#0f3d2a 0%,#1c7a4c 52%,#2bb35f 100%);color:#fff;border-radius:16px;padding:24px 26px}
.guide-cover:after{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.10)}
.guide-eyebrow{margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9}
.guide-title{margin:8px 0 8px;font-size:25px;line-height:1.25;position:relative}
.guide-sub{margin:0;opacity:.94;max-width:760px;line-height:1.6;position:relative}
.guide-metrics{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;position:relative}
.guide-metric{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.28);border-radius:12px;padding:8px 15px;min-width:72px;text-align:center;backdrop-filter:blur(2px)}
.guide-metric b{display:block;font-size:22px;font-weight:800;line-height:1.1}.guide-metric span{font-size:12px;opacity:.9}
.guide-route{display:grid}
.guide-day{display:grid;grid-template-columns:92px minmax(0,1fr);gap:16px}
.guide-day-rail{display:flex;flex-direction:column;align-items:center}
.guide-day-no{background:var(--tc-green);color:#fff;border-radius:999px;padding:6px 12px;font-weight:800;font-size:13px;white-space:nowrap}
.guide-day--arrival .guide-day-no{background:#f59e0b}.guide-day--depart .guide-day-no{background:#5b2bbd}
.guide-day-line{flex:1;width:2px;background:linear-gradient(#cfe3d6,#eef2f0);margin-top:8px;min-height:20px}
.guide-day:last-child .guide-day-line{display:none}
.guide-day-body{padding-bottom:24px;min-width:0}
.guide-day-title{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.guide-day-title h4{margin:0;font-size:19px}.guide-day-main{color:var(--tc-green-dark);font-weight:700}.guide-day-city{color:var(--muted);font-size:13px}
.guide-day-brief{margin:10px 0 12px;color:#38424f;background:#f6faf8;border:1px solid #e4eee8;border-radius:10px;padding:10px 13px;font-size:13.5px;line-height:1.6}
.guide-stops{display:grid;gap:12px}
.guide-stop{position:relative;display:grid;grid-template-columns:154px minmax(0,1fr);gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px;overflow:visible}
.guide-stop-img{width:154px;height:120px;border-radius:10px;object-fit:cover;background:#eef2f5}
.guide-stop-img-empty{display:flex;align-items:center;justify-content:center;color:var(--tc-green-dark);font-weight:800}
.guide-stop-body{min-width:0}
.guide-stop-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.guide-stop-top h5{margin:0;font-size:17px}
.guide-stop-price{color:var(--tc-orange);font-weight:800;white-space:nowrap}
.guide-stop-tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.guide-stop-tags span{background:#f1f5f4;color:#4b5563;border-radius:5px;padding:2px 8px;font-size:12px}
.guide-stop-desc{margin:6px 0 0;color:#3f4b5f;font-size:14px;line-height:1.55}
.guide-stop-meta{margin:7px 0 0;color:var(--muted);font-size:12.5px;overflow-wrap:anywhere}
.guide-stop .actions{margin-top:12px}
.guide-day-tip{display:flex;gap:10px;margin-top:12px;background:#fffaf0;border:1px solid #f5e2bd;border-radius:10px;padding:10px 13px}
.guide-day-tip span{color:#b45309;font-weight:800;white-space:nowrap;font-size:13px}.guide-day-tip p{margin:0;color:#7c5410;font-size:13px;line-height:1.6}
.guide-empty{color:var(--muted);margin:0}
.guide-block-head{display:flex;align-items:baseline;gap:10px;margin-bottom:12px}.guide-block-head h4{margin:0;font-size:19px}.guide-block-head span{color:var(--muted);font-size:13px}
.guide-food{background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px 18px}
.guide-food-chips{display:flex;flex-wrap:wrap;gap:8px}.guide-food-chip{background:#fff;border:1px solid #fdba74;color:#9a3412;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:600}
.guide-tips{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px}.guide-tips ul{margin:0;padding-left:20px;display:grid;gap:9px}.guide-tips li{color:#3f4b5f;line-height:1.6}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;display:grid;grid-template-columns:160px minmax(0,1fr);gap:16px}.thumb{width:160px;height:118px;object-fit:cover;border-radius:8px;background:#eef2f5}.thumb-empty{display:flex;align-items:center;justify-content:center;color:var(--tc-green-dark);font-weight:700;border:1px solid #d8eadf}.card-title-row{display:flex;justify-content:space-between;gap:14px}.type{margin:0 0 4px;color:var(--tc-green-dark);font-size:12px;font-weight:700}.card h3{margin:0;font-size:20px}.price{white-space:nowrap;color:var(--tc-orange);font-size:26px;font-weight:800}.price small{font-size:12px;color:var(--muted);margin-left:2px}.subtitle-line{margin:7px 0 0;color:#3f4b5f}.meta-line{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;color:var(--muted);font-size:13px}.meta-line span{background:#f7f8fa;border-radius:6px;padding:4px 7px}.tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.tags span{border:1px solid #d6eadf;color:var(--tc-green-dark);background:#f7fff9;border-radius:5px;padding:3px 7px;font-size:12px}.details{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px 14px;list-style:none;padding:0;margin:12px 0 0}.details li{font-size:13px;color:var(--muted);min-width:0}.details span{margin-right:6px}.details strong{color:#253047;font-weight:600}.actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:14px}.result-table .actions{margin-top:0}.table-actions{flex-wrap:nowrap;gap:16px}.btn{border:0;border-radius:7px;padding:8px 12px;text-decoration:none;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:82px}.btn-primary{background:var(--tc-green);color:#fff}.btn-primary:hover{background:var(--tc-green-dark)}.btn-ghost{background:#fff;border:1px solid var(--line);color:var(--tc-green-dark)}.qr-wrap{position:relative;display:inline-flex}.qr-pop{display:none;position:absolute;right:0;top:calc(100% + 8px);width:168px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;text-align:center;transform:translateY(-4px);box-shadow:0 10px 30px rgba(23,32,51,.12);z-index:30}.qr-wrap:hover .qr-pop{display:block;transform:translateY(0)}.qr-pop img{width:136px;height:136px}.qr-pop p{margin:4px 0 0;color:var(--muted);font-size:12px}
.modal{position:fixed;inset:0;background:rgba(10,16,28,.58);display:none;align-items:center;justify-content:center;z-index:50;padding:24px}.modal.is-open{display:flex}.modal-card{background:#fff;border-radius:14px;padding:24px;text-align:center}.modal-card img{width:240px;height:240px}.modal-card p{margin:12px 0 0;color:#253047;font-weight:700}.modal-close{position:absolute;right:24px;top:24px;border:0;border-radius:8px;background:#fff;padding:10px 14px;cursor:pointer}
@media (max-width:960px){.hotel-list-item,.scenery-list-item{grid-template-columns:minmax(132px,160px) minmax(0,1fr)}.hotel-list-side{grid-column:1/-1;justify-items:start}.hotel-list-side .actions{margin-top:0}}
@media (max-width:760px){.hotel-card{grid-template-columns:1fr}.hotel-img{width:100%;height:220px;min-height:0;border-radius:8px 8px 0 0}.scenery-img{width:100%;height:190px;min-height:0;border-radius:8px 8px 0 0}.hotel-body,.scenery-body{padding:16px}}
@media (max-width:720px){.topbar{padding:0 18px}.brand-logo{height:26px}.page{padding:18px 12px 32px}.card{grid-template-columns:1fr}.thumb{width:100%;height:180px;border-radius:8px}.hotel-list-img{height:150px}.card-title-row{display:block}.price{margin-top:8px}.actions{align-items:flex-start}.btn{display:inline-flex;text-align:center;min-height:36px}.qr-wrap{display:inline-flex}.qr-pop{display:none;position:absolute;left:0;right:auto;top:calc(100% + 8px);transform:translateY(-4px);margin-top:0;width:168px}.qr-wrap:hover .qr-pop{display:block;transform:translateY(0)}.result-table{min-width:880px}}
@media (max-width:560px){.hotel-list-item,.scenery-list-item{grid-template-columns:1fr}.hotel-list-img,.scenery-list-img{width:100%;height:180px;border-radius:8px}.hotel-list-side{justify-items:start}.hotel-list-side .actions{margin-top:0}.scenery-info{grid-template-columns:1fr}.itinerary-step{grid-template-columns:1fr}.itinerary-step span{justify-content:flex-start;width:max-content}.plan-activity{grid-template-columns:1fr}.plan-activity img,.plan-activity-empty{width:100%;height:180px}.guide-day{grid-template-columns:1fr;gap:10px}.guide-day-rail{flex-direction:row;align-items:center;gap:8px}.guide-day-line{display:none}.guide-day-body{padding-bottom:16px}.guide-stop{grid-template-columns:1fr}.guide-stop-img{width:100%;height:172px}.guide-cover{padding:20px}.guide-title{font-size:22px}}
`;
}

function build_js() {
  return `
function openQrModal(el){
  var src=el.getAttribute('data-qr');
  var title=el.getAttribute('data-title')||'微信扫码打开同程旅行小程序';
  var modal=document.getElementById('qrModal');
  document.getElementById('qrModalImg').src=src;
  document.getElementById('qrModalTitle').textContent=title;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
}
function closeQrModal(){
  var modal=document.getElementById('qrModal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden','true');
}
document.getElementById('qrModal').addEventListener('click',function(e){if(e.target===this)closeQrModal();});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeQrModal();});
function switchHotelView(btn,view){
  var section=btn.closest('.result-group');
  if(!section)return;
  section.querySelectorAll('.view-btn').forEach(function(item){item.classList.toggle('is-active',item===btn);});
  section.querySelectorAll('.hotel-view').forEach(function(item){item.classList.toggle('is-active',item.getAttribute('data-view')===view);});
}
function switchSceneryView(btn,view){
  var section=btn.closest('.result-group');
  if(!section)return;
  section.querySelectorAll('.view-btn').forEach(function(item){item.classList.toggle('is-active',item===btn);});
  section.querySelectorAll('.scenery-view').forEach(function(item){item.classList.toggle('is-active',item.getAttribute('data-view')===view);});
}
`;
}

function infer_file_topic(title, items, request_params) {
  const route = request_params.departure && request_params.destination
    ? `${request_params.departure}到${request_params.destination}`
    : (request_params.destination || request_params.departure || '');
  const mainType = is_itinerary_request(items, request_params) ? '行程规划' : infer_main_type_label(items);
  const extra = request_params.extra ? String(request_params.extra).replace(/\s+/g, '') : '';
  const prefix = route || extra || title || '同程旅行';
  return ensure_topic_suffix(`${prefix}${mainType}`);
}

function infer_main_type_label(items) {
  if (!items.length) {
    return '查询结果';
  }
  const first = items[0].type;
  return {
    flight: '机票推荐',
    train: '火车票推荐',
    bus: '汽车票推荐',
    hotel: '酒店推荐',
    scenery: '景点推荐',
    travel: '度假推荐',
    plan: '行程推荐'
  }[first] || '推荐结果';
}

function ensure_topic_suffix(topic) {
  if (/推荐|规划|查询结果$/.test(topic)) {
    return topic;
  }
  return `${topic}推荐`;
}

function sanitize_file_name(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

function unique_file_name(dir, preferred) {
  const ext = path.extname(preferred) || '.html';
  const base = sanitize_file_name(path.basename(preferred, ext)) || '同程旅行查询结果';
  let candidate = `${base}${ext}`;
  let index = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${index}${ext}`;
    index += 1;
  }
  return candidate;
}

async function fetch_image_as_data_uri(url) {
  if (!/^https?:\/\//i.test(String(url || ''))) {
    throw new Error('unsupported image url');
  }
  const buffer = await fetch_buffer(url, 5000, 1024 * 1024);
  const mime = infer_image_mime(url);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function fetch_buffer(url, timeout_ms, max_bytes) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http;
    const req = client.get(url, { timeout: timeout_ms }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        fetch_buffer(normalize_redirect_url(url, res.headers.location), timeout_ms, max_bytes).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`image status ${res.statusCode}`));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > max_bytes) {
          req.destroy(new Error('image too large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('timeout', () => req.destroy(new Error('image timeout')));
    req.on('error', reject);
  });
}

function normalize_redirect_url(base, location) {
  try {
    return new URL(location, base).toString();
  } catch (_) {
    return location;
  }
}

function infer_image_mime(url) {
  const clean = String(url || '').split('?')[0].toLowerCase();
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

function normalize_https_url(value) {
  const url = String(value || '').trim();
  if (!url) {
    return '';
  }
  if (url.startsWith('http://oss.ly.com/')) {
    return `https://${url.slice('http://'.length)}`;
  }
  if (url.startsWith('http://wx.17u.cn/')) {
    return `https://${url.slice('http://'.length)}`;
  }
  return url;
}

function load_logo_data_uri() {
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'tongcheng-logo.svg.gz'),
    path.join(__dirname, '..', '..', 'assets', 'tongcheng-logo.png.gz'),
    path.join(__dirname, '..', '..', 'extensions', 'workbuddy', 'assets', 'tongcheng-logo.png')
  ];

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) {
        continue;
      }
      if (file.endsWith('.png') || file.endsWith('.png.gz')) {
        const buffer = file.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)) : fs.readFileSync(file);
        return `data:image/png;base64,${buffer.toString('base64')}`;
      }
      const data = file.endsWith('.gz')
        ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')
        : fs.readFileSync(file, 'utf8');
      return `data:image/svg+xml;base64,${Buffer.from(data, 'utf8').toString('base64')}`;
    } catch (_) {
      // Ignore broken local assets and fall back to CSS mark.
    }
  }
  return '';
}

function pick_image_url(item, type) {
  if (type === 'flight' || type === 'train' || type === 'bus') {
    return '';
  }
  if (type === 'plan') {
    const firstActivity = Array.isArray(item.activitiyList) ? item.activitiyList.find((activity) => activity && activity.image) : null;
    const planImage = firstActivity ? firstActivity.image : item.image;
    const url = normalize_https_url(planImage || '');
    return is_http_url(url) ? url : '';
  }
  const url = normalize_https_url(item.image || item.imageUrl || item.imgUrl || item.coverImage || item.logoUrl || '');
  return is_http_url(url) ? url : '';
}

function pick_logo_url(item, type) {
  if (type !== 'flight') {
    return '';
  }
  const url = normalize_https_url(item.airlineLogoUrl || item.airlineLogo || item.logoUrl || '');
  return is_http_url(url) ? url : '';
}

function is_http_url(value) {
  return /^https?:\/\/[^\s]+$/i.test(String(value || '').trim());
}

function format_timestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function format_ticket_list(ticketList) {
  if (!Array.isArray(ticketList)) {
    return '';
  }
  return ticketList
    .filter((ticket) => ticket && ticket.ticketType && ticket.ticketPrice != null)
    .map((ticket) => `${ticket.ticketType}¥${ticket.ticketPrice}`)
    .join('，');
}

function append_terminal(name, terminal) {
  if (!name) {
    return '';
  }
  return terminal ? `${name}${terminal}` : name;
}

function duration_from_minutes(minutes) {
  const n = Number(minutes);
  if (!n || n <= 0) {
    return '';
  }
  const hours = Math.floor(n / 60);
  const mins = n % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}时${mins}分` : `${hours}时`;
  }
  return `${mins}分`;
}

function print_workbuddy_visual_response(payload) {
  console.log('WORKBUDDY_VISUAL_JSON_START');
  console.log(JSON.stringify(payload, null, 2));
  console.log('WORKBUDDY_VISUAL_JSON_END');
}

function normalize_markdown(markdown) {
  return repair_display_text(markdown).replace(/\n{3,}/g, '\n\n').trim();
}

function join_non_empty(values, sep) {
  return values.filter((value) => value != null && String(value).trim() !== '').map(String).join(sep);
}

function join_array(value, sep) {
  return Array.isArray(value) ? value.filter(Boolean).join(sep) : '';
}

function safe_text(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.includes('�')) {
    return '';
  }
  return repair_display_text(text);
}

function repair_display_text(value) {
  return String(value == null ? '' : value)
    .replace(/(\d+)\s*�+\s*(\d+)\s*分/g, '$1时$2分')
    .replace(/(\d+)\s*�+\s*分/g, '$1时')
    .replace(/价格最便�+的/g, '价格最便宜的')
    .replace(/最便�+/g, '最便宜')
    .trim();
}

function escape_html(value) {
  return repair_display_text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escape_attr(value) {
  return escape_html(value).replace(/\n/g, ' ');
}

module.exports = {
  is_display_contract_guard,
  build_workbuddy_visual_response,
  print_workbuddy_visual_response,
  collect_visual_items,
  sanitize_file_name,
  normalize_https_url,
  normalize_workbuddy_output_dir
};
