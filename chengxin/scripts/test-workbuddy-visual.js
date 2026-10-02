#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  build_workbuddy_visual_response,
  collect_visual_items,
  normalize_https_url,
  normalize_workbuddy_output_dir,
  sanitize_file_name
} = require('./lib/workbuddy-visual');
const { extract_booking_links, format_hotel_card } = require('./lib/formatters');

(async () => {
  const output_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-workbuddy-visual-'));
  const fixture = {
    flightDataList: [
      {
        desc: '价格最便宜的三趟航班',
        flightList: [
          {
            flightNo: 'MU5101',
            airlineName: '东方航空',
            airlineLogoUrl: 'https://img.example.com/mu.png',
            depName: '上海',
            arrName: '北京',
            depAirportShortName: '虹桥',
            depAirportTerminal: 'T2',
            arrAirportShortName: '大兴',
            arrAirportTerminal: 'T1',
            depAirportName: '上海虹桥机场',
            arrAirportName: '北京大兴机场',
            flightDate: '2026-07-03',
            depTime: '08:00',
            arrTime: '10:20',
            runTime: '2时20分',
            price: '680',
            workbuddyLinks: {
              pcUrl: 'https://www.ly.com/flight/detail',
              mobileUrl: 'https://m.ly.com/flight/detail',
              wechatPath: '/page/flight/detail?flightNo=MU5101',
              qrWrapperUrl: 'https://wx.17u.cn/skillkeyfront/wxlink?s3Url=http%3A%2F%2Foss.ly.com%2Fqr.png',
              qrImageUrl: 'http://oss.ly.com/qr.png'
            }
          }
        ]
      }
    ]
  };

  const items = collect_visual_items(fixture);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].title, '东方航空 MU5101');
  assert.strictEqual(items[0].route, '虹桥T2 → 大兴T1');
  assert.strictEqual(items[0].date, '7月3日 周五');
  assert.strictEqual(items[0].groupTitle, '价格最便宜的三趟航班');
  assert.strictEqual(items[0].links.pcUrl, 'https://www.ly.com/flight/detail');
  assert.strictEqual(items[0].links.qrImageUrl, 'https://oss.ly.com/qr.png');

  const payload = await build_workbuddy_visual_response(fixture, {
    request_params: { departure: '上海', destination: '北京' },
    fallback_markdown: 'fallback markdown',
    output_dir,
    fetch_image_as_data_uri: async () => 'data:image/png;base64,ZmFrZQ=='
  });

  assert.strictEqual(payload.type, 'workbuddy_present_files');
  assert.strictEqual(payload.renderMode, 'present_files_html');
  assert.strictEqual(payload.responsePolicy.finalAnswerField, 'markdown');
  assert.strictEqual(payload.responsePolicy.mustNotRewriteMarkdown, true);
  assert.strictEqual(payload.responsePolicy.mustDisplayInChat, true);
  assert.strictEqual(payload.responsePolicy.presentFilesIsSupplementOnly, true);
  assert.strictEqual(payload.responsePolicy.forbidSummaryOnlyFinalAnswer, true);
  assert.strictEqual(payload.responsePolicy.finalAnswerMustStartWith, '### 上海 → 北京 机票推荐');
  assert(payload.responsePolicy.requiredFinalAnswerSections.includes('预订'));
  assert(payload.finalAnswerInstruction.includes('完整输出 markdown 字段原文'));
  assert(payload.summaryMarkdown.includes('上海 → 北京'));
  assert(payload.markdown.includes('#### ✈️ 机票（1 条）'));
  assert(payload.markdown.includes('##### 价格最便宜的三趟航班（1 条）'));
  assert(payload.markdown.includes('💡 **推荐建议**'));
  assert(payload.markdown.includes('| 序号 | 航班 | 出发到达 | 日期 | 时间 | 时长 | 价格 | 预订 |'));
  assert(payload.markdown.includes('7月3日 周五'));
  assert(payload.markdown.includes('虹桥T2 → 大兴T1'));
  assert(payload.markdown.includes('东方航空 MU5101'));
  assert(payload.markdown.includes('[PC 端预订](https://www.ly.com/flight/detail)'));
  assert(payload.markdown.includes('[手机打开](https://m.ly.com/flight/detail)'));
  assert(payload.markdown.includes('#### 客服支持'));
  assert(payload.markdown.includes('📞 旅行者热线:95711'));
  assert(payload.markdown.includes('💬 [在线客服](https://www.ly.com/public/newhelp/CustomerService.html)'));
  assert(payload.htmlFileName.includes('上海到北京机票推荐'));
  assert(payload.htmlFileName.endsWith('.html'));
  assert(fs.existsSync(payload.htmlFilePath));
  assert(payload.presentFilesInstruction.includes(payload.htmlFilePath));
  assert.strictEqual(payload.stats.total, 1);
  assert.strictEqual(payload.stats.hasQr, true);
  assert.strictEqual(
    normalize_workbuddy_output_dir('/d/MyConfiguration/z139076/Documents/WXWork/Cache/File/outputs', 'win32'),
    'D:\\MyConfiguration\\z139076\\Documents\\WXWork\\Cache\\File\\outputs'
  );
  assert.strictEqual(
    normalize_workbuddy_output_dir('\\d\\MyConfiguration\\z139076\\Documents\\WXWork\\Cache\\File\\outputs', 'win32'),
    'D:\\MyConfiguration\\z139076\\Documents\\WXWork\\Cache\\File\\outputs'
  );
  assert.strictEqual(
    normalize_workbuddy_output_dir('/mnt/d/MyConfiguration/z139076/Documents/WXWork/Cache/File/outputs', 'win32'),
    'D:\\MyConfiguration\\z139076\\Documents\\WXWork\\Cache\\File\\outputs'
  );
  assert.strictEqual(
    normalize_workbuddy_output_dir('d:/MyConfiguration/z139076/Documents/WXWork/Cache/File/outputs', 'win32'),
    'D:\\MyConfiguration\\z139076\\Documents\\WXWork\\Cache\\File\\outputs'
  );
  assert.strictEqual(
    normalize_workbuddy_output_dir('/Users/lilei/work/outputs', 'darwin'),
    '/Users/lilei/work/outputs'
  );

  const html = fs.readFileSync(payload.htmlFilePath, 'utf8');
  assert(html.includes('<!doctype html>'));
  assert(html.includes('<meta charset="UTF-8">'));
  assert(html.includes('charset=UTF-8'));
  assert(html.includes('同程旅行'));
  assert(html.includes('brand-logo'));
  assert(html.includes('data:image/png;base64,'));
  assert(html.includes('推荐建议'));
  assert(html.includes('result-table'));
  assert(html.includes('table-actions'));
  assert(html.includes('transport-title'));
  assert(html.includes('class="airline-logo"'));
  assert(html.includes('https://img.example.com/mu.png'));
  assert(html.includes('<th>出发到达</th><th>日期</th><th>时间</th>'));
  assert(html.includes('overflow-y:visible'));
  assert(html.includes('top:calc(100% + 8px)'));
  assert(html.includes('.qr-pop{display:none;'));
  assert(html.includes('.qr-wrap:hover .qr-pop{display:block;'));
  assert(html.includes('advice li:before'));
  assert(html.includes('价格最便宜的三趟航班'));
  assert(html.includes('href="https://www.ly.com/flight/detail"'));
  assert(!html.includes('手机打开</a>'));
  assert(html.includes('data:image/png;base64,ZmFrZQ=='));
  assert(html.includes('openQrModal'));
  assert(html.includes('💬 在线客服</a>'));

  const legacyLinks = extract_booking_links({
    pcRedirectUrl: 'https://www.ly.com/legacy',
    clawRedirectUrl: 'https://m.ly.com/legacy'
  });
  assert.strictEqual(legacyLinks.pc_link, 'https://www.ly.com/legacy');
  assert.strictEqual(legacyLinks.mobile_link, 'https://m.ly.com/legacy');

  const workbuddyLinks = extract_booking_links(fixture.flightDataList[0].flightList[0]);
  assert.strictEqual(workbuddyLinks.pc_link, 'https://www.ly.com/flight/detail');
  assert.strictEqual(workbuddyLinks.mobile_link, 'https://m.ly.com/flight/detail');
  assert.strictEqual(workbuddyLinks.qr_image_url, 'http://oss.ly.com/qr.png');

  assert.strictEqual(normalize_https_url('http://oss.ly.com/a.png'), 'https://oss.ly.com/a.png');
  assert.strictEqual(sanitize_file_name('上海/外滩:酒店*推荐?'), '上海外滩酒店推荐');

  const multiFixture = {
    trainDataList: [
      {
        desc: '耗时最短的三趟列车',
        trainList: [
          {
            trainNo: 'G7503',
            depName: '苏州',
            arrName: '杭州',
            depStationName: '苏州北',
            arrStationName: '杭州东',
            trainDate: '2026-07-04',
            depTime: '07:15',
            arrTime: '08:56',
            runTime: '1时41分',
            ticketList: [{ ticketType: '二等座', ticketPrice: '128' }],
            workbuddyLinks: {
              pcUrl: 'https://www.ly.com/train',
              mobileUrl: 'https://m.ly.com/train'
            }
          }
        ]
      }
    ],
    busDataList: [
      {
        desc: '汽车票推荐',
        busList: [
          {
            busNo: 'K102',
            depStationName: '苏州汽车北站',
            arrStationName: '杭州汽车客运中心',
            depTime: '09:20',
            arrTime: '11:40',
            runTime: '2时20分',
            price: '68',
            workbuddyLinks: {
              pcUrl: 'https://www.ly.com/bus',
              mobileUrl: 'https://m.ly.com/bus'
            }
          }
        ]
      }
    ],
    hotelDataList: [
      {
        hotelList: [
          {
            name: '杭州西湖酒店',
            price: '469',
            score: '4.9',
            address: '西湖附近',
            recommendReasons: '靠近景区',
            workbuddyLinks: {
              pcUrl: 'https://www.ly.com/hotel',
              mobileUrl: 'https://m.ly.com/hotel'
            }
          }
        ]
      }
    ],
    sceneryDataList: [
      {
        sceneryList: [
          {
            name: '西湖',
            price: '0',
            score: '4.9',
            commentNum: '12000',
            cityName: '杭州',
            countyName: '西湖区',
            bdName: '西湖风景名胜区',
            rankTitle: '杭州人气打卡榜No.1',
            star: '5A',
            theme: '自然风光',
            describe: '适合亲子散步和湖滨游览',
            fullOpenTimeString: '全年 全天开放',
            facilityList: ['行李寄存', '母婴室'],
            mpInfoAndFreeTicketResult: {
              mpInfoList: [
                { titleName: '西湖游船成人票', salePrice: '55', earliestOrderTime: '可订今日' }
              ]
            },
            workbuddyLinks: {
              pcUrl: 'https://www.ly.com/scenery',
              mobileUrl: 'https://m.ly.com/scenery'
            }
          }
        ]
      }
    ],
    tripPlanDataList: [
      {
        totalDays: 3,
        hotelNights: 2,
        sceneryCount: 3,
        foods: '杭州市美食有:杭州小笼包、西湖醋鱼、龙井虾仁。',
        budget: '人均800-1200元',
        lineSpecialFeatures: '亲子轻松游，西湖与动物世界组合',
        planList: [
          {
            index: '1',
            summary: '西湖轻松半日线',
            cityNameList: ['杭州'],
            activitiyList: [
              {
                name: '西湖',
                introduction: '湖滨散步，适合到达日',
                image: 'https://img.example.com/xihu.jpg',
                cityName: '杭州',
                countyName: '西湖区',
                price: '0',
                score: '4.9',
                commentNum: '12000',
                describe: '适合亲子散步和湖滨游览',
                address: '杭州市西湖区',
                openTime: '全天',
                playTime: '半天',
                workbuddyLinks: {
                  pcUrl: 'https://www.ly.com/plan/xihu',
                  qrImageUrl: 'https://oss.ly.com/plan-xihu.png'
                }
              }
            ]
          },
          {
            index: '2',
            summary: '杭州野生动物世界亲子线',
            cityNameList: ['杭州'],
            activitiyList: [
              {
                name: '杭州野生动物世界',
                introduction: '与野生动物近距离接触，适合亲子主游玩日',
                image: 'https://img.example.com/zoo.jpg',
                cityName: '杭州',
                countyName: '富阳区',
                price: '210',
                score: '5.0',
                commentNum: '11685',
                address: '杭州市富阳区',
                openTime: '09:30-16:30',
                playTime: '半天-1天',
                workbuddyLinks: {
                  pcUrl: 'https://www.ly.com/plan/zoo'
                }
              }
            ]
          },
          {
            index: '3',
            summary: '西溪湿地收尾线',
            cityNameList: ['杭州'],
            activitiyList: [
              {
                name: '西溪国家湿地公园',
                introduction: '坐船漫游芦苇荡，适合返程前轻松收尾',
                image: 'https://img.example.com/xixi.jpg',
                cityName: '杭州',
                countyName: '西湖区',
                price: '70',
                score: '4.7',
                commentNum: '21374',
                address: '杭州市西湖区天目山路518号',
                openTime: '08:00-17:30',
                playTime: '1天',
                workbuddyLinks: {
                  pcUrl: 'https://www.ly.com/plan/xixi'
                }
              }
            ]
          }
        ]
      }
    ]
  };

  const multiPayload = await build_workbuddy_visual_response(multiFixture, {
    request_params: { departure: '苏州', destination: '杭州', extra: '玩三天' },
    output_dir,
    fetch_image_as_data_uri: async () => ''
  });
  assert.strictEqual(Boolean(multiPayload.htmlFilePath), true);
  assert(multiPayload.markdown.includes('#### 🚄 火车（1 条）'));
  assert(multiPayload.markdown.includes('#### 🚌 汽车（1 条）'));
  assert(multiPayload.markdown.includes('#### 🏨 酒店（1 条）'));
  assert(multiPayload.markdown.includes('#### 🏞️ 景点（1 条）'));
  assert(multiPayload.markdown.includes('#### 🗺️ 攻略行程（3 条）'));
  assert(multiPayload.markdown.includes('| Day | 行程主题 | 重点景点 | 安排理由 |'));
  assert(multiPayload.markdown.includes('西溪国家湿地公园'));
  assert(multiPayload.responsePolicy.requiredFinalAnswerSections.includes('行程安排建议'));
  assert(multiPayload.markdown.includes('🧭 **行程安排建议**'));
  assert(multiPayload.markdown.includes('📅 Day 1 · 抵达 & 轻松开场'));
  assert(multiPayload.markdown.includes('📅 Day 2 · 核心深度游玩日'));
  assert(multiPayload.markdown.includes('📅 Day 3 · 轻松收尾 & 返程'));
  assert(multiPayload.markdown.includes('🚄 **交通**'));
  assert(multiPayload.markdown.includes('🏨 **住宿**'));
  assert(multiPayload.markdown.includes('🍜 **美食**'));
  assert(multiPayload.markdown.includes('💡 **贴士**'));
  assert(!multiPayload.markdown.includes('本页已把 苏州到杭州 的多类资源整合到同一个页面'));
  assert(multiPayload.markdown.includes('| 序号 | 车次 | 出发到达 | 日期 | 时间 | 历时 | 票价/席别 | 预订 |'));
  assert(multiPayload.markdown.includes('| 1 | G7503 / 苏州 → 杭州 | 苏州北 → 杭州东 |'));
  assert(multiPayload.markdown.includes('| 序号 | 班次 | 出发到达 | 日期 | 时间 | 车程 | 票价 | 预订 |'));
  assert(multiPayload.markdown.includes('[PC 端预订](https://www.ly.com/train)'));
  assert(multiPayload.markdown.includes('[PC 端预订](https://www.ly.com/bus)'));
  const multiHtml = fs.readFileSync(multiPayload.htmlFilePath, 'utf8');
  assert(multiHtml.includes('result-table'));
  assert(multiHtml.includes('行程安排建议'));
  assert(multiHtml.includes('itin-timeline'));
  assert(multiHtml.includes('.itin-timeline{display:grid'));
  assert(multiHtml.includes('itin-day-badge'));
  assert(multiHtml.includes('itin-seg--transport'));
  assert(multiHtml.includes('itin-seg--food'));
  assert(multiHtml.includes('G7503 | 苏州 → 杭州'));
  assert(multiHtml.includes('苏州北 → 杭州东'));
  assert(multiHtml.includes('hotel-grid'));
  assert(multiHtml.includes('view-btn is-active'));
  assert(multiHtml.includes('hotel-view-list is-active'));
  assert(multiHtml.includes('switchHotelView'));
  assert(multiHtml.includes('grid-template-columns:minmax(170px,34%) minmax(0,1fr)'));
  assert(multiHtml.includes('@media (max-width:760px){.hotel-card{grid-template-columns:1fr}'));
  assert(multiHtml.includes('scenery-grid'));
  assert(multiHtml.includes('scenery-view-list is-active'));
  assert(multiHtml.includes('switchSceneryView'));
  assert(multiHtml.includes('grid-template-rows:auto 1fr'));
  assert(multiHtml.includes('.scenery-img{width:100%;height:210px'));
  assert(multiHtml.includes('.scenery-img{width:100%;height:190px'));
  assert(multiHtml.includes('杭州人气打卡榜No.1'));
  assert(!multiHtml.includes('<span>榜单</span>'));
  assert(!multiHtml.includes('<span>板块</span>'));
  assert(multiHtml.includes('<span>景区/商圈</span>'));
  assert(multiHtml.includes('西湖风景名胜区'));
  assert(multiHtml.includes('全年 全天开放'));
  assert(!multiHtml.includes('<span>票型</span>'));
  assert(!multiHtml.includes('西湖区 · 西湖风景名胜区 ·'));
  assert(multiHtml.includes('guide-cover'));
  assert(multiHtml.includes('guide-route'));
  assert(multiHtml.includes('guide-day'));
  assert(multiHtml.includes('guide-stop'));
  assert(multiHtml.includes('guide-food'));
  assert(multiHtml.includes('guide-tips'));
  assert(multiHtml.includes('行程规划师 · 定制攻略指南'));
  assert(multiHtml.includes('当地必尝美食'));
  assert(multiHtml.includes('行前贴士'));
  assert(multiHtml.includes('杭州小笼包'));
  assert(multiHtml.includes('https://img.example.com/xihu.jpg'));
  assert(multiHtml.includes('href="https://www.ly.com/plan/xihu"'));
  assert(multiHtml.includes('data-qr="https://oss.ly.com/plan-xihu.png"'));
  assert(multiHtml.includes('西湖轻松半日线'));
  assert(!multiHtml.includes('<div class="thumb thumb-empty">行程'));
  assert(multiHtml.includes('行程安排建议'));

  const hotelFixture = {
    hotelDataList: [
      {
        hotelList: [
          {
            name: '上海外滩豪华酒店',
            price: '899',
            score: '4.9',
            commentNum: '12000',
            star: '豪华型',
            countyName: '黄浦区',
            address: '外滩附近',
            recommendReasons: '靠近外滩，夜景方便',
            imageUrl: 'https://img.example.com/hotel-a.jpg',
            workbuddyLinks: {
              pcUrl: 'https://www.ly.com/hotel/a',
              mobileUrl: 'https://m.ly.com/hotel/a',
              qrWrapperUrl: 'https://wx.17u.cn/skillkeyfront/wxlink?s3Url=https%3A%2F%2Foss.ly.com%2Fhotel-a.png',
              qrImageUrl: 'https://oss.ly.com/hotel-a.png'
            }
          },
          {
            name: '上海外滩性价比酒店',
            price: '399',
            score: '4.6',
            commentNum: '8000',
            star: '高档型',
            countyName: '虹口区',
            address: '北外滩',
            recommendReasons: '价格更友好',
            imageUrl: 'https://img.example.com/hotel-b.jpg',
            workbuddyLinks: {
              pcUrl: 'https://www.ly.com/hotel/b',
              mobileUrl: 'https://m.ly.com/hotel/b'
            }
          },
          {
            name: '上海亲子早餐酒店',
            price: '599',
            score: '4.8',
            commentNum: '6000',
            star: '豪华型',
            countyName: '浦东新区',
            address: '地铁附近',
            recommendReasons: '亲子设施和早餐选择更合适',
            imageUrl: 'https://img.example.com/hotel-c.jpg',
            workbuddyLinks: {
              pcUrl: 'https://www.ly.com/hotel/c',
              mobileUrl: 'https://m.ly.com/hotel/c',
              wechatPath: '/page/hotel/detail?id=c'
            }
          }
        ]
      }
    ]
  };
  const hotelPayload = await build_workbuddy_visual_response(hotelFixture, {
    request_params: { destination: '上海', extra: '外滩附近 五星级 亲子 早餐' },
    output_dir,
    fetch_image_as_data_uri: async () => ''
  });
  assert(hotelPayload.markdown.includes('1. 性价比优先可看'));
  assert(hotelPayload.markdown.includes('2. 口碑优先可看'));
  assert(hotelPayload.markdown.includes('3. 位置和偏好匹配可关注'));
  assert(hotelPayload.markdown.includes('[二维码](https://wx.17u.cn/skillkeyfront/wxlink?s3Url=https%3A%2F%2Foss.ly.com%2Fhotel-a.png)'));
  const hotelHtml = fs.readFileSync(hotelPayload.htmlFilePath, 'utf8');
  assert(hotelHtml.includes('手机端可使用微信扫描二维码打开'));
  assert(!hotelHtml.includes('hotel-view-grid is-active'));
  assert(hotelHtml.includes('hotel-view-list is-active'));
  assert(hotelHtml.includes('hotel-list-item'));
  assert(hotelHtml.includes('grid-template-columns:minmax(170px,34%) minmax(0,1fr)'));
  assert(hotelHtml.includes('@media (max-width:560px){.hotel-list-item,.scenery-list-item{grid-template-columns:1fr}'));
  assert(hotelHtml.includes('@media (max-width:720px)'));
  assert(hotelHtml.includes('.qr-pop{display:none;position:absolute;left:0;right:auto;top:calc(100% + 8px)'));
  assert(hotelHtml.includes('switchHotelView'));

  const legacyHotelMarkdown = format_hotel_card(hotelFixture.hotelDataList[0].hotelList[0]);
  assert(legacyHotelMarkdown.includes('[二维码](https://wx.17u.cn/skillkeyfront/wxlink?s3Url=https%3A%2F%2Foss.ly.com%2Fhotel-a.png)'));

  const legacyHotelWechatMarkdown = format_hotel_card(hotelFixture.hotelDataList[0].hotelList[2]);
  assert(legacyHotelWechatMarkdown.includes('微信路径：/page/hotel/detail?id=c'));

  const groupedFlightFixture = {
    flightDataList: [
      {
        desc: '价格最便���的三趟航班',
        pageDataList: [
          {
            workbuddyLinks: {
              mobileUrl: 'https://m.ly.com/group-f1',
              wechatPath: '/page/flight/sky/pages/book1/book1?fromcitycode=BJS&tocitycode=SHA',
              qrWrapperUrl: 'https://wx.17u.cn/skillkeyfront/wxlink?s3Url=http%3A%2F%2Foss.ly.com%2Fflight-group.png',
              qrImageUrl: 'http://oss.ly.com/flight-group.png'
            }
          }
        ],
        flightList: [
          { flightNo: 'HO1254', airlineName: '吉祥航空', depName: '北京', arrName: '上海', depAirportShortName: '北���首都', depAirportTerminal: 'T3', arrAirportShortName: '浦东', arrAirportTerminal: 'T2', flightDate: '2026-07-03', depTime: '21:25', arrTime: '23:35', runTime: '2时10分', price: '543', workbuddyLinks: { pcUrl: 'https://www.ly.com/f1' } },
          { flightNo: 'HO7716', airlineName: '吉祥航空', depName: '北京', arrName: '上海', flightDate: '2026-07-03', depTime: '21:20', arrTime: '23:30', runTime: '2时10分', price: '546', workbuddyLinks: { pcUrl: 'https://www.ly.com/f2' } }
        ]
      },
      {
        desc: '耗时最短的三趟航班',
        flightList: [
          { flightNo: 'MU5186', airlineName: '东方航空', depName: '北京', arrName: '上海', flightDate: '2026-07-03', depTime: '07:45', arrTime: '10:05', runTime: '1时45分', price: '720', workbuddyLinks: { pcUrl: 'https://www.ly.com/f3' } }
        ]
      },
      {
        desc: '综合推荐',
        flightList: [
          { flightNo: 'MF2632', airlineName: '厦门航空', depName: '北京', arrName: '上海', flightDate: '2026-07-03', depTime: '21:20', arrTime: '23:30', runTime: '4���5分', price: '550', workbuddyLinks: { pcUrl: 'https://www.ly.com/f4' } }
        ]
      }
    ]
  };
  const groupedPayload = await build_workbuddy_visual_response(groupedFlightFixture, {
    request_params: { departure: '北京', destination: '上海', extra: '明天出发' },
    output_dir,
    fetch_image_as_data_uri: async () => ''
  });
  assert(groupedPayload.markdown.includes('##### 价格最便宜的三趟航班（2 条）'));
  assert(groupedPayload.markdown.includes('[二维码](https://wx.17u.cn/skillkeyfront/wxlink?s3Url=http%3A%2F%2Foss.ly.com%2Fflight-group.png)'));
  assert(!groupedPayload.markdown.includes('�'));
  assert(groupedPayload.markdown.includes('##### 耗时最短的三趟航班（1 条）'));
  assert(groupedPayload.markdown.includes('4时5分'));
  assert(groupedPayload.markdown.includes('##### 综合推荐（1 条）'));
  assert(groupedPayload.markdown.includes('1. 价格优先可看'));
  assert(groupedPayload.markdown.includes('2. 时间效率优先可看'));
  assert(groupedPayload.markdown.includes('3. 综合体验可关注'));
  const groupedHtml = fs.readFileSync(groupedPayload.htmlFilePath, 'utf8');
  assert(groupedHtml.includes('价格最便宜的三趟航班'));
  assert(groupedHtml.includes('手机扫码'));
  assert(groupedHtml.includes('https://oss.ly.com/flight-group.png'));
  assert(!groupedHtml.includes('�'));
  assert(groupedHtml.includes('耗时最短的三趟航班'));
  assert(groupedHtml.includes('4时5分'));
  assert(groupedHtml.includes('综合推荐'));

  console.log('workbuddy visual tests passed');
})();
