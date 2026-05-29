/* ================================================================
 *  「碎镜记 · 18年与1秒」目录态
 *  - 镜宫吊灯炸裂定格 → 在空间中挑 10 块大碎片
 *  - 每块碎片旁挂 3D Sprite 月光文字标签（带「」尖括号）
 *  - 点击任一碎片 → 火焰溶解切到对应全景图 + 浮层叙事卡片
 *  - 任意 5 个场景看完后 → 自动恢复爆炸 → 灼烧 → 星芒 → 结语
 * ================================================================ */

const DIRECTORY_TRIGGER_COUNT = 5; // 触发结局所需的"已读"场景数（不含镜宫）

const DIRECTORY_SCENES = [
  { key:'shrine', label:'镜中圣陵', en:'ALI-IBN-HAMZEH SHRINE · SHIRAZ',
    coord:'SHIRAZ · 29.61°N / 52.58°E', day:'01', title:'阿里·伊本·哈姆泽圣陵',
    pano:'./assets/pano-shrine.jpg', icon:'./assets/01.png',
    short:'十万片威尼斯镜片镶进穹顶，把光关进镜子里。今年的玫瑰，烂在地里。',
    lines:[
      {text:'公元 9 世纪，什叶派圣裔阿里·伊本·哈姆泽长眠于此。',quiet:false},
      {text:'十二个世纪后，恺加王朝的工匠把十万片威尼斯镜片切成星芒与菱形，',quiet:false},
      {text:'一寸一寸镶进穹顶——这门工艺叫 Ayeneh-kari，"把光关进镜子里"。',quiet:false},
      {text:'2026 年 4 月 6 日，设拉子石化厂被击中。冲击波以每秒 340 米掠过城区。',quiet:true},
      {text:'没有直接命中，但圣陵管理处写道："部分镜面出现松动迹象。"',quiet:false},
      {text:'设拉子被称为玫瑰之城，每年五月，大马士革玫瑰要被蒸馏成 Golab——',quiet:false},
      {text:'用于清洗圣陵的每一道缝隙。今年的五月，物流断了，玫瑰烂在地里。',quiet:false},
      {text:'镜子碎了，还能看见光。但当玫瑰不再盛开，圣陵便失去了呼吸的气息。',quiet:true},
    ],
    symbol:{name:'玫瑰水 · Golab',quote:'没有一颗炸弹直接落在玫瑰园里，但玫瑰水的供应链断了。战争杀死事物的方式，比我们想象的更沉默。'} },

  { key:'aliqapu', label:'高门', en:'ALI QAPU PALACE · ISFAHAN',
    coord:'ISFAHAN · 32.65°N / 51.67°E', day:'02', title:'阿里卡普宫',
    pano:'./assets/pano-aliqapu.jpg', icon:'./assets/02.png',
    short:'25 万片骨与铜拼成的首饰盒，需要一千二百名工匠。如今，作坊歇业。',
    lines:[
      {text:'Ali Qapu，波斯语"高门"。',quiet:false},
      {text:'1592 年起，萨法维国王在这道门后接见世界——',quiet:false},
      {text:'奥斯曼的使臣，莫卧儿的商队，欧洲的传教士。',quiet:false},
      {text:'他们带着各自的礼物来，带着 Khatam 镶嵌的首饰盒离开：',quiet:true},
      {text:'骆驼骨、乌木和黄铜丝拼成六角星，每平方厘米 250 片碎料。',quiet:false},
      {text:'一个首饰盒需要 25 万片。',quiet:false},
      {text:'2026 年 3 月 31 日，宫殿六层木质结构发生位移，',quiet:true},
      {text:'贴金天花板"像枯叶一样脱落"——这是文化遗产局官员的原话。',quiet:false},
      {text:'伊斯法罕的 Khatam 工匠曾有 1200 人，现在作坊歇业，工匠离散。',quiet:false},
      {text:'高门紧闭。没有使臣，没有礼物，只有等待重新贴金的天花板。',quiet:true},
    ],
    symbol:{name:'Khatam 镶嵌工艺品',quote:'25 万片碎料拼成一个首饰盒，一次爆炸让整座城市的工匠放下工具。战争摧毁的不只是建筑，还有建造的人。'} },

  { key:'music', label:'消失的乐声', en:'ALI QAPU MUSIC ROOM · ISFAHAN',
    coord:'ISFAHAN · 32.65°N / 51.67°E', day:'03', title:'阿里卡普宫·音乐厅',
    pano:'./assets/pano-music.jpg', icon:'./assets/03.png',
    short:'墙上的镂空花瓶让塞塔尔的轻声共鸣 400 年。冲击波后，穹顶出现裂纹。',
    lines:[
      {text:'阿里卡普宫的第六层，没有壁画，没有镜面。',quiet:false},
      {text:'墙上密布着花瓶形状的镂空——Tong-bori，一种 400 年前的声学装置。',quiet:false},
      {text:'萨法维的工匠不懂物理公式，但他们知道：',quiet:true},
      {text:'当塞塔尔琴的四根弦在这个房间里震动，',quiet:false},
      {text:'声波会钻进每一个镂空的"花瓶"，',quiet:false},
      {text:'在石膏与空气的交界处来回折返，最后从穹顶汇聚成一个完美的共振点。',quiet:false},
      {text:'塞塔尔，波斯语"三根弦"，是苏菲修行者用来接近真主的乐器——',quiet:true},
      {text:'它的声音很轻，轻到只适合独奏和冥想。',quiet:false},
      {text:'2026 年 3 月 31 日，冲击波抵达这里时，已不足以震碎玻璃。',quiet:true},
      {text:'但灰泥是脆弱的。文物专家在穹顶发现了肉眼难辨的微裂纹。',quiet:false},
    ],
    symbol:{name:'塞塔尔琴 · Setar',quote:'塞塔尔的声音很轻，轻到只适合在安静的房间里独奏。2026 年的伊朗，没有一个地方足够安静。'} },

  { key:'caravan', label:'丝路尽头', en:'AMIN OD-DOWLEH PLAZA · KASHAN',
    coord:'KASHAN · 33.98°N / 51.41°E', day:'04', title:'阿明·奥多莱商队客栈',
    pano:'./assets/pano-caravan.jpg', icon:'./assets/04.png',
    short:'一张地毯，八百万个结，三年时光。出口暴跌 99%，80% 织工失业。',
    lines:[
      {text:'恺加王朝的商人阿明·奥多莱在 1863 年建造这座客栈时，',quiet:false},
      {text:'不会想到它会成为世界上最精美的穆卡纳斯穹顶之一——',quiet:false},
      {text:'蜂窝状的石膏单元层层叠叠向上收拢，像一朵用数学公式折叠的花。',quiet:true},
      {text:'160 年来，这里是波斯地毯的定价中心。',quiet:false},
      {text:'大不里士的羊毛、库姆的丝线、伊斯法罕的图案，在这个穹顶下找到买家。',quiet:false},
      {text:'一张上等地毯需要一家人织三年，八百万个结，',quiet:false},
      {text:'每个结都是一次指尖与丝线的对话。',quiet:true},
      {text:'2026 年，地毯出口从 25 亿美元暴跌至不足 4000 万美元，80% 织工失业。',quiet:true},
      {text:'卡尚大巴扎的穹顶出现了细微裂缝，但没有人来修——',quiet:false},
      {text:'巴扎里已经没有多少商户了。',quiet:false},
    ],
    symbol:{name:'波斯地毯',quote:'一张地毯，八百万个结，三年时光。一场战争，九十天，让这一切失去了买家。'} },

  { key:'chehel', label:'四十柱的倒影', en:'CHEHEL SOTUN GARDEN · ISFAHAN',
    coord:'ISFAHAN · 32.66°N / 51.68°E', day:'05', title:'四十柱宫·花园',
    pano:'./assets/pano-chehel.jpg', icon:'./assets/05.png',
    short:'15 万朵番红花换 1 公斤红色黄金。海峡封锁，红丝堆在仓库里。',
    lines:[
      {text:'波斯人从不直说"四十"，这个数字意味着"很多，多到数不清"。',quiet:false},
      {text:'四十柱宫其实只有二十根雪松木柱，',quiet:false},
      {text:'但当它们倒映在门前的水池中，便成了四十。',quiet:true},
      {text:'1647 年，萨法维王朝在这座花园里种下了他们对天堂的想象：',quiet:false},
      {text:'水池、柏树、玫瑰——还有藏红花。波斯人称它为 Za\'feran，红色黄金。',quiet:false},
      {text:'15 万朵番红花，只能换 1 公斤藏红花。',quiet:true},
      {text:'2026 年 3 月，霍尔木兹海峡封锁。藏红花的出口路线断了。',quiet:true},
      {text:'霍拉桑的农民还在采摘，但红色黄金堆积在仓库里，',quiet:false},
      {text:'价格飙升到每公斤 1250 美元，买家却在大洋彼岸干等。',quiet:false},
    ],
    symbol:{name:'藏红花 · Saffron',quote:'15 万朵花，换 3 根红丝。一条海峡，断了 3000 年的颜色。'} },

  { key:'imam', label:'波斯蓝', en:'IMAM MOSQUE · ISFAHAN',
    coord:'ISFAHAN · 32.65°N / 51.67°E', day:'06', title:'伊玛目清真寺',
    pano:'./assets/pano-imam.jpg', icon:'./assets/06.png',
    short:'18 年，4750 万块七色瓷砖。庭院的角落，碎片越捡越多。',
    lines:[
      {text:'1611 年，萨法维国王阿巴斯一世决定建造一座前所未有的清真寺。',quiet:false},
      {text:'他没能看到竣工——工程持续了 18 年，4750 万块瓷砖，',quiet:false},
      {text:'每一块都在窑炉中接受七种颜色的洗礼。波斯人称之为 Haft-rangi。',quiet:true},
      {text:'那种蓝，来自阿富汗巴达赫尚省的青金石矿。',quiet:false},
      {text:'商队把石头运过兴都库什山脉，工匠把它研磨成粉，',quiet:false},
      {text:'与釉料混合，在 1200 度的窑火中烧成永恒——蓝得像天空落在地上的碎片。',quiet:true},
      {text:'2026 年，持续的冲击波让穹顶出现结构性裂缝。',quiet:true},
      {text:'庭院的角落里，文保人员收集到越来越多蓝色的碎片。',quiet:false},
      {text:'没有人知道还要掉多少块，才算"严重受损"。',quiet:false},
    ],
    symbol:{name:'七色瓷砖 · Haft-rangi',quote:'瓷砖上有七种颜色，但人们只数得清正在脱落的那一种。'} },

  { key:'masumeh', label:'金顶下的祈祷', en:'HAZRAT MASUMEH SHRINE · QOM',
    coord:'QOM · 34.64°N / 50.88°E', day:'07', title:'法蒂玛·马苏梅圣陵',
    pano:'./assets/pano-masumeh-1_v2.jpg', icon:'./assets/07.png',
    short:'剥开石榴，里面全是光。这是波斯人对黑夜的回答。如今被堵在了路上。',
    lines:[
      {text:'库姆是伊朗的精神首都。',quiet:false},
      {text:'公元 816 年，先知穆罕默德的后裔法蒂玛·马苏梅病逝于此。',quiet:false},
      {text:'她的陵墓在此后 1200 年里不断扩建，',quiet:false},
      {text:'金色穹顶成为什叶派世界最神圣的天际线之一。',quiet:true},
      {text:'信徒们带着石榴来到这里。波斯人称它为 Anār。',quiet:false},
      {text:'5000 年前，琐罗亚斯德教的祭司在 Yasna 仪式中供奉它，',quiet:false},
      {text:'因为石榴树四季常青，象征灵魂不朽。',quiet:false},
      {text:'每年冬至的雅尔达之夜，伊朗人围坐在一起剥开石榴——',quiet:true},
      {text:'那些宝石般的红色籽粒，是光明终将战胜黑暗的承诺。',quiet:false},
      {text:'2026 年 3 月 16 日，库姆周边主要道路封锁。',quiet:true},
      {text:'没有炮弹落在圣陵，但设拉子的石榴运不进来了。',quiet:false},
    ],
    symbol:{name:'石榴 · Anār',quote:'石榴是波斯人对黑夜的回答：剥开它，里面全是光。2026 年，这个回答被堵在了路上。'} },

  { key:'pink', label:'粉红清真寺的早晨', en:'NASIR AL-MULK MOSQUE · SHIRAZ',
    coord:'SHIRAZ · 29.60°N / 52.55°E', day:'08', title:'莫克清真寺',
    pano:'./assets/pano-pink.jpg', icon:'./assets/08.png',
    short:'波斯猫从皇宫走过 400 年，2026 年走不出设拉子。',
    lines:[
      {text:'游客们叫它"粉红清真寺"，波斯人叫它"莫克"。',quiet:false},
      {text:'1876 至 1888 年，恺加王朝的工匠用粉红瓷砖和 Orsi 彩色玻璃建造了这座奇观。',quiet:false},
      {text:'每天清晨七点，阳光穿过万花筒般的窗棂，在地毯上画满彩虹。',quiet:true},
      {text:'但设拉子不只有清真寺。这座城市还有另一种"活的文化遗产"——波斯猫。',quiet:false},
      {text:'1620 年，意大利旅行家从呼罗珊把第一批长毛猫带回欧洲。',quiet:false},
      {text:'在萨法维宫廷，它们被称为 buraq，只有皇室成员才能豢养。',quiet:false},
      {text:'1871 年，维多利亚女王在伦敦买下两只波斯猫，从此风靡欧洲贵族圈。',quiet:true},
      {text:'2019 年，伊朗把波斯猫列为国家文化遗产。',quiet:false},
      {text:'2026 年，设拉子的繁殖场陷入停滞——国际血统登记系统中断，出口航线取消。',quiet:true},
      {text:'莫克的彩色玻璃还在透光。但那些在波斯宫廷踱步的白色身影，正在失去血统证明。',quiet:false},
    ],
    symbol:{name:'波斯猫 · Gorbe-ye Irāni',quote:'波斯猫走过 400 年，从皇宫走到世界。2026 年，它们走不出设拉子了。'} },

  { key:'lotfollah', label:'孔雀的尾巴', en:'SHEIKH LOTFOLLAH MOSQUE · ISFAHAN',
    coord:'ISFAHAN · 32.65°N / 51.68°E', day:'09', title:'希赫洛特夫拉清真寺',
    pano:'./assets/pano-lotfollah.jpg', icon:'./assets/09.png',
    short:'穹顶上的孔雀不是画的，是光算出来的。瓷砖一脱落，公式就错了。',
    lines:[
      {text:'这座清真寺没有宣礼塔，因为它不对公众开放。',quiet:false},
      {text:'1603 至 1619 年，萨法维国王阿巴斯一世用 16 年时间，',quiet:false},
      {text:'为他的后宫建造了一座私人祈祷所。',quiet:false},
      {text:'穹顶是它的秘密。19 万片马赛克瓷砖按照精密的数学公式排列，',quiet:true},
      {text:'当阳光以特定角度射入侧窗，光束会在穹顶内壁汇聚成一条金色的弧线——',quiet:false},
      {text:'像一只孔雀正在开屏的尾羽。',quiet:false},
      {text:'随着太阳移动，这只孔雀会缓缓旋转，',quiet:true},
      {text:'从奶油色变成玫瑰粉，最后消失在黄昏里。',quiet:false},
      {text:'2026 年 3 月 31 日，希赫洛特夫拉清真寺的穹顶出现瓷砖脱落，内部采光窗破碎。',quiet:true},
      {text:'孔雀开屏需要 400 年的积累。让它合上，只需要一次震动。',quiet:false},
    ],
    symbol:{name:'波斯孔雀 · Tāvus',quote:'穹顶上的孔雀不是画出来的，是光算出来的。当瓷砖脱落，公式就错了。'} },

  { key:'miniature', label:'画中人', en:'CHEHEL SOTUN INTERIOR · ISFAHAN',
    coord:'ISFAHAN · 32.66°N / 51.68°E', day:'10', title:'四十柱宫·内部',
    pano:'./assets/pano-miniature.jpg', icon:'./assets/10.png',
    short:'细密画里每一个人物都有名有姓。一道裂缝从国王眉心划过。',
    lines:[
      {text:'走进四十柱宫的深处，你会和萨法维王朝的人对视。',quiet:false},
      {text:'他们存在于细密画的笔触里。波斯细密画是一种不留空白的艺术：',quiet:false},
      {text:'松鼠毛做成的画笔，蘸着青金石蓝、朱砂红、孔雀绿——',quiet:false},
      {text:'这些矿物颜料从丝绸之路的各个角落汇聚而来。',quiet:true},
      {text:'一幅巴掌大的细密画，需要画三个月。',quiet:false},
      {text:'墙上画着国王阿巴斯大帝接见乌兹别克使臣，',quiet:false},
      {text:'画着宫廷乐师弹奏塞塔尔琴，画着波斯美人斟酒——',quiet:false},
      {text:'每一个人物都有名有姓，每一个场景都是历史的切片。',quiet:true},
      {text:'2026 年，震动让这些面容开始模糊。',quiet:true},
      {text:'一道裂缝从国王的眉心划过，颜料层正在脱落。',quiet:false},
      {text:'画中人还在微笑，但微笑正在消失。',quiet:false},
    ],
    symbol:{name:'波斯细密画 · Miniature',quote:'细密画不留空白，因为波斯人相信空白是虚无。现在，裂缝正在把画面变成虚无。'} },
];

/* ---------------- 状态 ---------------- */
let _dirInited = false;
let _dirBigShards = [];   // [{mesh, sceneCfg, sprite, origMat, highMat, visited, ...}]
let _dirOverlayEl = null;
let _dirHintEl = null;
let _dirGroup = null;

const _dirTmpV = new THREE.Vector3();

/* ---------------- 月光文字 Sprite 工厂 ---------------- */
function makeGoldTextSprite(text, dayText){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 720, H = 260;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mainY = H / 2 - 24;

  // 文案用「」尖括号包裹
  const wrapped = '「' + text + '」';

  // 极淡外光晕
  ctx.shadowColor = 'rgba(255, 240, 220, 0.55)';
  ctx.shadowBlur = 32;
  const spaced = wrapped.split('').join(' ');
  ctx.font = '300 70px "Noto Serif SC", "Songti SC", "STSong", "PingFang SC", serif';
  ctx.fillStyle = 'rgba(255, 245, 225, 0.8)';
  ctx.fillText(spaced, W / 2, mainY);

  // 第二层弱光晕
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(255, 250, 235, 0.95)';
  ctx.fillText(spaced, W / 2, mainY);

  // 主体：象牙白 → 浅银渐变
  ctx.shadowBlur = 0;
  const grad = ctx.createLinearGradient(0, mainY - 45, 0, mainY + 35);
  grad.addColorStop(0, '#fffdf2');
  grad.addColorStop(0.5, '#f5ecd6');
  grad.addColorStop(1, '#cdb98e');
  ctx.fillStyle = grad;
  ctx.fillText(spaced, W / 2, mainY);

  // 细描边
  ctx.strokeStyle = 'rgba(50, 35, 18, 0.6)';
  ctx.lineWidth = 0.8;
  ctx.strokeText(spaced, W / 2, mainY);

  // day xx 副标题
  if(dayText){
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.font = '200 22px "Courier New", "Source Code Pro", monospace';
    ctx.fillStyle = 'rgba(220, 200, 165, 0.55)';
    const dayStr = ('day  ' + dayText).split('').join(' ');
    ctx.fillText('—  ' + dayStr + '  —', W / 2, mainY + 64);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const spr = new THREE.Sprite(mat);
  // 标签放大 1.55×：宽 75 / 高 27（之前 48 / 17.3 太小看不清）
  spr.scale.set(75, 27, 1);
  spr.userData._dirIsLabel = true;
  spr.userData._dirBaseScale = { x: 75, y: 27 };
  return spr;
}

/* ---------------- 入口：暂停爆炸，启动目录 ---------------- */
function pauseCollapseForDirectory(){
  console.log('[directory] pauseCollapseForDirectory 触发');
  try {
    const mdlG = MODELS.golestan;
    if(mdlG._collapseDirectoryReady) return;
    mdlG._collapseDirectoryReady = true;
    mdlG._collapsePaused = true;
    mdlG._directoryDoneCount = 0;

    if(mdlG._nextHintTimeout){ clearTimeout(mdlG._nextHintTimeout); mdlG._nextHintTimeout = null; }
    if(mdlG._collapseTimeout){ clearTimeout(mdlG._collapseTimeout); mdlG._collapseTimeout = null; }

    if(typeof autoRotateSpeed !== 'undefined'){
      autoRotateSpeed = AUTO_ROTATE_BOOST_SETTLE * 0.4;
      _autoRotateBoostStart = 0;
    }

    setupDirectoryFragments();
    console.log('[directory] 爆炸定格 → 进入目录态');
  } catch(e){
    console.error('[directory] pauseCollapseForDirectory 抛错:', e && e.message, e && e.stack && e.stack.split('\n')[1]);
  }
}

/* ---------------- 从目录恢复：继续爆炸 → 灼烧 → 星芒 → 结语 ---------------- */
function resumeCollapseFromDirectory(){
  const mdlG = MODELS.golestan;
  if(!mdlG._collapsePaused) return;
  mdlG._collapsePaused = false;
  teardownDirectoryFragments();

  /* —— 清理暂停态自转的 userData，让 mixer 重新接管节点 quaternion —— */
  mdlG._pauseSpinElapsed = undefined;
  /* —— 清理减速窗口状态，让 mixer 恢复全速跑（resume 后碎片继续爆炸） —— */
  mdlG._collapseDecayFactor = undefined;
  mdlG._collapseDecayStartTime = null;
  if(mdlG._spinTargets && mdlG._spinTargets.length){
    for(let i = 0; i < mdlG._spinTargets.length; i++){
      const o = mdlG._spinTargets[i];
      if(o && o.userData){
        o.userData._prevQuat = null;
        o.userData._prevDt = null;
        o.userData._spinAxis = null;
        o.userData._spinOmega0 = 0;
      }
    }
  }

  /* —— 进入终幕：先把目录态 UI 全部隐藏，避免烧灼时还能看到玫瑰宫等标签 —— */
  document.body.classList.add('finale-on');
  if(_dirOverlayEl){
    _dirOverlayEl.classList.remove('show');
    _dirOverlayEl.classList.remove('expanded');
  }
  if(_dirHintEl) _dirHintEl.classList.remove('show');
  if(typeof storyEl !== 'undefined' && storyEl){
    storyEl.classList.remove('show');
    storyEl.classList.remove('collapse-story');
  }
  if(typeof nextHint !== 'undefined' && nextHint){
    nextHint.classList.remove('show');
  }

  /* —— 此刻才启动全景烧灼层（11s 缓慢焦化到全黑）——
   *    爆炸瞬间不烧，让用户看着完整镜宫读完碎片后，才在结语开场时一起焦化
   *    时长拉长到 11s（之前 7s 太快），让灼烧在视觉上更"绵长" */
  if(typeof panoBurnSphere !== 'undefined' && panoBurnSphere){
    panoBurnSphere.visible = true;
    panoBurnSphere.material.uniforms.uProgress.value = 0.05;  // 零星焦斑起点
    mdlG._burnStartTime = performance.now();
    mdlG._burnTotal = 11.0;
  }

  const totalSec = mdlG._collapseTotalSec || 7;
  const playedSec = shardMixer ? shardMixer.time : (mdlG._collapsePauseT || 0.9);
  const remainSec = Math.max(2, totalSec - playedSec);

  const shardGroup = shardInstMeshes[0] && shardInstMeshes[0].inst;
  const shardScene = shardModelMeshes && shardModelMeshes.scene;
  mdlG._collapseTimeout = setTimeout(() => {
    if(mdlG.collapseState === 'collapsing'){
      mdlG.collapseState = 'done';
      crystalCollapseActive = false;
      /* 注意：不再移除 shardGroup —— 让碎片留在场景里，
       * 烧灼到全黑后它们的反光本身就是"星空"（用户要求沿用上一版） */
      shardMixer = null;
      shardExtraFall = {};
      /* 保留 dustPoints —— 灼烧到全黑后这些微尘碎片要继续悬浮，
       * 给画面留一层"风中余烬"的呼吸感。不再清理它的 geometry/material。 */
      if(mdlG._blastLight && mdlG._blastLight.parent) mdlG._blastLight.parent.remove(mdlG._blastLight);
      if(mdlG._shardDirLight && mdlG._shardDirLight.parent) mdlG._shardDirLight.parent.remove(mdlG._shardDirLight);
      if(mdlG._shardDirLight2 && mdlG._shardDirLight2.parent) mdlG._shardDirLight2.parent.remove(mdlG._shardDirLight2);
      if(mdlG._shardAmbLight && mdlG._shardAmbLight.parent) mdlG._shardAmbLight.parent.remove(mdlG._shardAmbLight);
    }
  }, remainSec * 1000);

  // 终幕文字与烧灼同步出现（不再等到烧灼结束）：
  // 800ms 后烧灼已经有起色（焦斑明显），文字渐入更有"灰烬中显字"的层次
  mdlG._nextHintTimeout = setTimeout(() => {
    if(typeof showFinale === 'function') showFinale();
  }, 800);

  if(typeof autoRotateActive !== 'undefined'){
    autoRotateActive = true;
    autoRotateSpeed = AUTO_ROTATE_BOOST_PEAK * 0.6;
    _autoRotateBoostStart = performance.now();
  }

  console.log('[directory] 已读 5 个 → 启动烧灼 → 即将进入终幕');
}

/* ---------------- 候选收集 + FPS 散开采样 ---------------- */
function _collectShardCandidates(shardGroup){
  const out = [];
  shardGroup.updateMatrixWorld(true);
  shardGroup.traverse(o => {
    if(!o.isMesh || !o.visible || o._isShardGround) return;
    const b = new THREE.Box3().setFromObject(o);
    if(b.isEmpty()) return;
    const s = new THREE.Vector3(); b.getSize(s);
    const c = new THREE.Vector3(); b.getCenter(c);
    const vol = s.x * s.y * s.z;
    const radius = c.length();
    out.push({ mesh: o, volume: vol, center: c.clone(), radius });
  });
  return out;
}

function _pickSpreadShards(candidates, k){
  if(candidates.length === 0) return [];
  const byVol = candidates.slice().sort((a, b) => b.volume - a.volume);
  // 10 个标签需要更大的候选池才能散开
  const poolSize = Math.min(byVol.length, Math.max(k * 4, 40));
  const pool = byVol.slice(0, poolSize);
  const picked = [pool[0]];
  pool[0]._picked = true;
  while(picked.length < k && picked.length < pool.length){
    let bestIdx = -1, bestMinDist = -1;
    for(let i = 0; i < pool.length; i++){
      const c = pool[i];
      if(c._picked) continue;
      let minD = Infinity;
      for(const p of picked){
        const d = c.center.distanceTo(p.center);
        if(d < minD) minD = d;
      }
      if(minD > bestMinDist){ bestMinDist = minD; bestIdx = i; }
    }
    if(bestIdx < 0) break;
    pool[bestIdx]._picked = true;
    picked.push(pool[bestIdx]);
  }
  for(const c of pool) delete c._picked;
  return picked;
}

/* ---------------- 选 10 块大碎片 + 创建 Sprite 标签 ---------------- */
function setupDirectoryFragments(){
  if(_dirInited) return;
  console.log('[directory] setupDirectoryFragments 开始');
  const shardGroup = shardInstMeshes[0] && shardInstMeshes[0].inst;
  if(!shardGroup){ console.warn('[directory] 没有可用的碎片 group'); return; }

  const candidates = _collectShardCandidates(shardGroup);
  console.log('[directory] 候选碎片数=', candidates.length);
  if(candidates.length === 0){ console.warn('[directory] 没找到合适的碎片'); return; }

  const picked = _pickSpreadShards(candidates, DIRECTORY_SCENES.length);
  console.log('[directory] 已挑选=', picked.length, '/', DIRECTORY_SCENES.length);

  if(!_dirGroup){
    _dirGroup = new THREE.Group();
    _dirGroup.renderOrder = 999;
    scene.add(_dirGroup);
  }

  ensureDirectoryDom();

  _dirBigShards = picked.map((p, i) => {
    const sceneCfg = DIRECTORY_SCENES[i];
    const mesh = p.mesh;
    const origMat = mesh.material;
    let highMat = origMat;
    if(origMat){
      highMat = origMat.clone();
      if(highMat.emissive){
        highMat.emissive = new THREE.Color(0xffd28a);
        highMat._dirBaseEmissive = 0.6;
        highMat.emissiveIntensity = highMat._dirBaseEmissive;
      }
      highMat.transparent = true;
      if(highMat._origOpacityTarget !== undefined){
        highMat._origOpacityTarget = Math.min(1.0, highMat._origOpacityTarget);
      }
      mesh.material = highMat;
    }

    const sprite = makeGoldTextSprite(sceneCfg.label, sceneCfg.day);
    sprite.position.copy(p.center);
    sprite.position.y += 9;
    sprite.userData._dirIdx = i;
    _dirGroup.add(sprite);

    return {
      mesh, sceneCfg, sprite, origMat, highMat,
      visited: false,
      worldCenter: p.center.clone(),
      _appearStart: performance.now() + i * 90,
    };
  });

  if(_dirHintEl){
    _dirHintEl.classList.add('show');
    _dirHintEl.textContent = '触碰发光的碎片  ·  0 / ' + DIRECTORY_TRIGGER_COUNT;
  }

  _dirInited = true;
  console.log('[directory] 挑出', _dirBigShards.length, '块大碎片（FPS 散开）');
}

/* ---------------- 每帧更新：星辰呼吸 ---------------- */
function updateDirectoryFragments(time){
  if(!_dirInited) return;
  const now = performance.now();
  for(let i = 0; i < _dirBigShards.length; i++){
    const item = _dirBigShards[i];
    const mesh = item.mesh;
    if(!mesh) continue;

    if(item.sprite && item.sprite.material){
      const dt = (now - item._appearStart) / 600;
      const fadeIn = Math.max(0, Math.min(1, dt));

      if(item.visited){
        item.sprite.material.opacity = fadeIn * 0.42;
        const base = item.sprite.userData._dirBaseScale;
        if(base) item.sprite.scale.set(base.x * 0.95, base.y * 0.95, 1);
      } else {
        // —— 强化呼吸闪烁：让标签显眼可见 ——
        // (1) 慢呼吸（2.4Hz 节奏）让 opacity 在 0.7~1.0 之间起伏
        // (2) 叠加 flash 尖脉冲（5.6Hz）：每隔约 1.1s 出现一次短亮峰，模拟"星光闪烁"
        // (3) scale 跟随放大 1.0~1.18，闪光峰再额外 +8%
        const phase = time * 2.4 + i * 1.7;
        const breath = (Math.sin(phase) * 0.5 + 0.5);   // 0~1
        const fast = Math.sin(time * 5.6 + i * 3.1);
        const flash = Math.pow(Math.max(fast, 0.0), 8.0); // 0~1，尖锐脉冲
        const opacity = 0.70 + breath * 0.30 + flash * 0.20;
        item.sprite.material.opacity = fadeIn * Math.min(1.0, opacity);
        const scale = 1.0 + breath * 0.18 + flash * 0.08;
        const base = item.sprite.userData._dirBaseScale;
        if(base) item.sprite.scale.set(base.x * scale, base.y * scale, 1);
      }
    }

    if(item.highMat && item.highMat.emissive){
      if(item.visited){
        item.highMat.emissiveIntensity = 0.12;
      } else {
        const phase = time * 2.4 + i * 1.7;
        const breath = (Math.sin(phase) * 0.5 + 0.5);
        const fast = Math.sin(time * 5.6 + i * 3.1);
        const flash = Math.pow(Math.max(fast, 0.0), 8.0);
        // 让 mesh 自身发光也跟标签同步闪烁（更醒目）
        item.highMat.emissiveIntensity = 0.45 + breath * 1.0 + flash * 0.6;
      }
    }
  }
}

/* ---------------- 拆除目录态 ---------------- */
function teardownDirectoryFragments(){
  if(_dirOverlayEl) _dirOverlayEl.classList.remove('show');
  if(_dirHintEl) _dirHintEl.classList.remove('show');
  for(const item of _dirBigShards){
    if(item.sprite){
      if(item.sprite.parent) item.sprite.parent.remove(item.sprite);
      if(item.sprite.material){
        if(item.sprite.material.map) item.sprite.material.map.dispose();
        item.sprite.material.dispose();
      }
    }
    if(item.mesh && item.origMat){
      item.mesh.material = item.origMat;
    }
  }
  _dirBigShards = [];
  if(_dirGroup){
    if(_dirGroup.parent) _dirGroup.parent.remove(_dirGroup);
    _dirGroup = null;
  }
  _dirInited = false;
}

/* ---------------- 浮层 DOM ---------------- */
function ensureDirectoryDom(){
  if(!_dirHintEl){
    _dirHintEl = document.createElement('div');
    _dirHintEl.id = 'dirHint';
    _dirHintEl.className = 'dir-hint';
    document.body.appendChild(_dirHintEl);
  }
  if(!_dirOverlayEl){
    _dirOverlayEl = document.createElement('div');
    _dirOverlayEl.id = 'dirOverlay';
    _dirOverlayEl.className = 'dir-overlay';
    _dirOverlayEl.innerHTML = ''
      + '<div class="dir-overlay-bg"></div>'
      /* —— 简短卡（默认显示，靠下，不挡视线） —— */
      + '<div class="dir-overlay-mini">'
      +   '<button class="dir-mini-close" aria-label="close">'
      +     '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>'
      +   '</button>'
      +   '<img class="dir-mini-icon" alt="">'
      +   '<div class="dir-mini-text">'
      +     '<div class="dir-mini-label"></div>'
      +     '<div class="dir-mini-short"></div>'
      +   '</div>'
      +   '<button class="dir-mini-expand">查看碎片故事 <span>›</span></button>'
      + '</div>'
      /* —— 完整卡（点"查看碎片故事"后展开） —— */
      + '<div class="dir-overlay-card">'
      +   '<button class="dir-overlay-close" aria-label="close">'
      +     '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>'
      +   '</button>'
      +   '<div class="dir-overlay-en"></div>'
      +   '<div class="dir-overlay-title"></div>'
      +   '<div class="dir-overlay-coord"></div>'
      +   '<div class="dir-overlay-lines"></div>'
      +   '<div class="dir-overlay-symbol">'
      +     '<img class="dir-overlay-symbol-img" alt="">'
      +     '<div class="dir-overlay-symbol-text">'
      +       '<div class="dir-overlay-symbol-name"></div>'
      +       '<div class="dir-overlay-symbol-quote"></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="dir-overlay-footer">触碰外部 · 收起</div>'
      + '</div>';
    document.body.appendChild(_dirOverlayEl);
    _dirOverlayEl.querySelector('.dir-overlay-bg').addEventListener('click', closeDirectoryOverlay);
    _dirOverlayEl.querySelector('.dir-overlay-close').addEventListener('click', collapseDirectoryCard);
    _dirOverlayEl.querySelector('.dir-mini-close').addEventListener('click', closeDirectoryOverlay);
    _dirOverlayEl.querySelector('.dir-mini-expand').addEventListener('click', expandDirectoryCard);
  }
}

/* ---------- 子场景 FOV 统一：让全景图距离感与镜宫一致 ---------- */
var DIR_PANO_FOV = 100;    // 子场景统一 FOV（垂直 100° → 竖屏手机上垂直占全景 55%，
                           //  从拱顶到地板都能看到，类似原图等距柱状投影展开后的"一段"视野）
var DIR_HOME_FOV = null;   // 进入子场景时记录镜宫 FOV，回家时还原

function _applyDirSceneFov(){
  if(typeof camera === 'undefined' || !camera) return;
  if(DIR_HOME_FOV === null) DIR_HOME_FOV = camera.fov;
  if(camera.fov !== DIR_PANO_FOV){
    camera.fov = DIR_PANO_FOV;
    camera.updateProjectionMatrix();
  }
}
function _restoreHomeFov(){
  if(typeof camera === 'undefined' || !camera) return;
  if(DIR_HOME_FOV !== null && camera.fov !== DIR_HOME_FOV){
    camera.fov = DIR_HOME_FOV;
    camera.updateProjectionMatrix();
  }
}

/* ---------------- 全景图映射 ---------------- *
 * 必须用静态字面量（避免 page-deploy 拼接陷阱）
 * ---------------------------------------------------------------- */
var DIR_PANO_MAP = {
  shrine:    './assets/pano-shrine_v2.jpg',
  aliqapu:   './assets/pano-aliqapu.jpg',
  music:     './assets/pano-music.jpg',
  caravan:   './assets/pano-caravan.jpg',
  chehel:    './assets/pano-chehel.jpg',
  imam:      './assets/pano-imam.jpg',
  masumeh:   './assets/pano-masumeh-1_v2.jpg',
  pink:      './assets/pano-pink.jpg',
  lotfollah: './assets/pano-lotfollah.jpg',
  miniature: './assets/pano-miniature.jpg',
};

var DIR_HOME_PANO_URL = './golestan_360.jpg';

/* ---------------- 填充 + 打开/关闭浮层 ---------------- */
function _fillDirOverlayContent(cfg){
  // —— 简短卡（底部不打扰） ——
  const miniIcon  = _dirOverlayEl.querySelector('.dir-mini-icon');
  const miniLabel = _dirOverlayEl.querySelector('.dir-mini-label');
  const miniShort = _dirOverlayEl.querySelector('.dir-mini-short');
  if(cfg.icon){ miniIcon.src = cfg.icon; miniIcon.style.display = ''; }
  else { miniIcon.style.display = 'none'; }
  miniLabel.textContent = '「' + cfg.label + '」 · day ' + cfg.day;
  miniShort.textContent = cfg.short || '';

  // —— 完整卡（点"查看碎片故事"才展开） ——
  _dirOverlayEl.querySelector('.dir-overlay-en').textContent = cfg.en;
  _dirOverlayEl.querySelector('.dir-overlay-title').textContent = '「' + cfg.label + '」 · ' + cfg.title;
  _dirOverlayEl.querySelector('.dir-overlay-coord').textContent = cfg.coord + '  ·  day ' + cfg.day;
  const linesEl = _dirOverlayEl.querySelector('.dir-overlay-lines');
  linesEl.innerHTML = '';
  cfg.lines.forEach((l, li) => {
    const p = document.createElement('p');
    p.className = l.quiet ? 'quiet' : '';
    p.textContent = l.text;
    p.style.transitionDelay = (li * 70 + 200) + 'ms';
    linesEl.appendChild(p);
  });
  const symEl = _dirOverlayEl.querySelector('.dir-overlay-symbol');
  if(cfg.symbol){
    symEl.style.display = '';
    const img = symEl.querySelector('.dir-overlay-symbol-img');
    if(cfg.icon){ img.src = cfg.icon; img.style.display = ''; }
    else { img.style.display = 'none'; }
    symEl.querySelector('.dir-overlay-symbol-name').textContent = cfg.symbol.name;
    symEl.querySelector('.dir-overlay-symbol-quote').textContent = cfg.symbol.quote;
  } else {
    symEl.style.display = 'none';
  }
  return linesEl;
}

/* 展开完整卡 / 收起完整卡（只切两个 class，不影响场景） */
function expandDirectoryCard(){
  if(!_dirOverlayEl) return;
  _dirOverlayEl.classList.add('expanded');
  // 让叙事行逐行浮现
  const linesEl = _dirOverlayEl.querySelector('.dir-overlay-lines');
  setTimeout(() => {
    linesEl.querySelectorAll('p').forEach(p => p.classList.add('show'));
  }, 80);
}
function collapseDirectoryCard(){
  if(!_dirOverlayEl) return;
  _dirOverlayEl.classList.remove('expanded');
  const linesEl = _dirOverlayEl.querySelector('.dir-overlay-lines');
  if(linesEl) linesEl.querySelectorAll('p').forEach(p => p.classList.remove('show'));
}

function _updateDirSpritesVisibility(){
  if(!_dirGroup) return;
  _dirGroup.visible = true;
  for(let i = 0; i < _dirBigShards.length; i++){
    const spr = _dirBigShards[i].sprite;
    if(spr){
      spr.visible = (i !== _dirCurrentSceneIdx);
    }
  }
}

function openDirectoryOverlay(idx){
  const item = _dirBigShards[idx];
  if(!item) return;
  if(_dirSwitchingScene) return;
  if(idx === _dirCurrentSceneIdx) return;
  const cfg = item.sceneCfg;
  if(!_dirOverlayEl) return;

  _dirSwitchingScene = true;
  _dirCurrentSceneIdx = idx;

  /* 进入子场景全景图：sparkle 控制
   * - shrine（镜中圣陵 · 镜面镶嵌）：启用 5000 颗细小反光点（DenseOnly 模式）
   * - 其他子场景：关闭闪光点
   */
  if(typeof sparkleGroup !== 'undefined' && sparkleGroup){
    if(cfg.key === 'shrine'){
      sparkleGroup.visible = true;
      // 启用 DenseOnly 模式：只渲染 5000 颗 DENSE 加密层，隐藏 480 颗 BASE 大颗 + 星芒
      if(typeof sparkleMat !== 'undefined' && sparkleMat.uniforms.uDenseOnly){
        sparkleMat.uniforms.uDenseOnly.value = 1;
      }
      // 同时隐藏 flareSprites（八角星芒贴图，水晶专属，不适合镜面）
      if(typeof flareSprites !== 'undefined'){
        for(const spr of flareSprites) spr.visible = false;
      }
    } else {
      sparkleGroup.visible = false;
    }
  }

  /* 进入子场景：隐藏碎片地图（碎片仅在镜宫显示） */
  if(_dirGroup) _dirGroup.visible = false;

  /* 进入子场景：隐藏吊灯爆炸的整堆碎片 mesh（不让它们漂在全景图前面遮挡视线）
   * —— 微尘粒子 dustPoints 保留，作为"风中余烬"层 */
  if(typeof shardInstMeshes !== 'undefined' && shardInstMeshes && shardInstMeshes[0] && shardInstMeshes[0].inst){
    shardInstMeshes[0].inst.visible = false;
  }

  if(!item.visited){
    item.visited = true;
    const mdlG = MODELS.golestan;
    mdlG._directoryDoneCount = (mdlG._directoryDoneCount || 0) + 1;
    if(_dirHintEl){
      const done = mdlG._directoryDoneCount;
      _dirHintEl.textContent = done >= DIRECTORY_TRIGGER_COUNT
        ? '碎片已尽数触碰  ·  闭眼'
        : '触碰发光的碎片  ·  ' + done + ' / ' + DIRECTORY_TRIGGER_COUNT;
    }
  }

  const panoUrl = DIR_PANO_MAP[cfg.key];

  /* 切场前先收起当前的完整卡和 mini 卡，避免火焰过渡时旧卡挂着 */
  _dirOverlayEl.classList.remove('show');
  _dirOverlayEl.classList.remove('expanded');

  /* 进入子场景：FOV 改为随灼烧同步渐变（在 transitionMainPanoCrossfade 内部插值），
   * 避免"灼烧前后两次瞬时放大"。先记录 home FOV，但不立即切换。 */
  if(typeof camera !== 'undefined' && camera){
    if(DIR_HOME_FOV === null) DIR_HOME_FOV = camera.fov;
  }
  const _curFov = (typeof camera !== 'undefined' && camera) ? camera.fov : null;

  /* —— 火焰溶解 2.4s（拉长，让灼烧前线推进更绵长可见） ——
   *    fromTex 由 transitionMainPanoCrossfade 自动取当前 scene.background（即镜宫）
   *    用户视觉：镜宫 → 火焰前线 → 子场景全景图 */
  _fillDirOverlayContent(cfg);
  if(typeof transitionMainPanoCrossfade === 'function' && panoUrl){
    transitionMainPanoCrossfade(panoUrl, 'dir_' + cfg.key, 3.0, () => {
      document.body.classList.add('dir-detail-open');
      if(_dirHintEl) _dirHintEl.classList.remove('show');
      // 火焰过渡完成 → 浮出 mini 卡（完整卡需要用户主动点开）
      _dirOverlayEl.classList.add('show');
      _dirSwitchingScene = false;
      _maybeTriggerFinaleFromOverlay();
    }, (_curFov !== null) ? { fromFov: _curFov, toFov: DIR_PANO_FOV } : null);
  } else {
    if(!panoUrl) console.warn('[directory] DIR_PANO_MAP 未配置 key=', cfg.key);
    document.body.classList.add('dir-detail-open');
    _dirOverlayEl.classList.add('show');
    _dirSwitchingScene = false;
    _maybeTriggerFinaleFromOverlay();
  }
}

/* 检查是否已经够 5 个；若够则在浮层右上角换成"前往结语"按钮提示 */
function _maybeTriggerFinaleFromOverlay(){
  const mdlG = MODELS.golestan;
  const done = mdlG && mdlG._directoryDoneCount || 0;
  if(done >= DIRECTORY_TRIGGER_COUNT){
    if(_dirHintEl){
      _dirHintEl.textContent = '碎片已尽数触碰  ·  闭眼';
      _dirHintEl.classList.add('show');
    }
  }
}

function closeDirectoryOverlay(){
  if(!_dirOverlayEl) return;

  const mdlG = MODELS.golestan;
  const allDone = (mdlG._directoryDoneCount || 0) >= DIRECTORY_TRIGGER_COUNT;

  _dirOverlayEl.classList.remove('show');
  _dirOverlayEl.classList.remove('expanded');

  if(allDone && mdlG._collapsePaused){
    /* —— 读满 5 个：从当前子场景全景图直接火焰过渡回镜宫，
     *    完成后立刻 resume（resume 内部会启动烧灼 + 隐藏所有目录态 UI） —— */
    _dirCurrentSceneIdx = -1;
    for(let i = 0; i < _dirBigShards.length; i++){
      const spr = _dirBigShards[i].sprite;
      if(spr) spr.visible = true;
    }
    // FOV 改为与灼烧同步渐变（不再瞬切），消除回家瞬间的"放大"突变
    const _curFov1 = (typeof camera !== 'undefined' && camera) ? camera.fov : null;
    const _toFov1  = (DIR_HOME_FOV !== null) ? DIR_HOME_FOV : _curFov1;

    if(typeof transitionMainPanoCrossfade === 'function'){
      transitionMainPanoCrossfade(DIR_HOME_PANO_URL, 'golestan', 3.0, () => {
        if(_dirGroup) _dirGroup.visible = true;
        // 回镜宫：恢复吊灯爆炸碎片显示
        if(typeof shardInstMeshes !== 'undefined' && shardInstMeshes && shardInstMeshes[0] && shardInstMeshes[0].inst){
          shardInstMeshes[0].inst.visible = true;
        }
        document.body.classList.remove('dir-detail-open');
        // 给镜宫一个短暂的"完整呈现"瞬间（让用户感到回归），然后启动终幕烧灼
        setTimeout(() => {
          if(mdlG._collapsePaused) resumeCollapseFromDirectory();
        }, 600);
      }, (_curFov1 !== null && _toFov1 !== null) ? { fromFov: _curFov1, toFov: _toFov1 } : null);
    } else {
      resumeCollapseFromDirectory();
    }
  } else {
    /* —— 普通关闭：从当前子场景火焰过渡回镜宫，重新显示碎片地图，让用户继续选择。
     *    用户体验：mini 卡 close → 火焰溶解 → 镜宫闪光点 + 碎片地图 → 点新碎片 → 火焰溶解 → 子场景。
     *    每次切换都是清晰的一次 home 中转，不会有"新→旧"的视觉跳变。 */
    _dirCurrentSceneIdx = -1;
    /* 把所有碎片 sprite 重置为可见（可能上次进过的 sprite 被隐藏了） */
    for(let i = 0; i < _dirBigShards.length; i++){
      const spr = _dirBigShards[i].sprite;
      if(spr) spr.visible = true;
    }
    // FOV 改为与灼烧同步渐变（不再瞬切），消除回家瞬间的"放大"突变
    const _curFov2 = (typeof camera !== 'undefined' && camera) ? camera.fov : null;
    const _toFov2  = (DIR_HOME_FOV !== null) ? DIR_HOME_FOV : _curFov2;

    if(typeof transitionMainPanoCrossfade === 'function'){
      transitionMainPanoCrossfade(DIR_HOME_PANO_URL, 'golestan', 3.0, () => {
        /* 回到镜宫：清理 dir-detail-open（关掉镜宫主标签则不需要，
         * 但因为整个目录态由 dir-overlay 控制 UI，主标签其实不会出现，安全起见保留 class）。
         * 显示碎片地图 + 恢复闪光点 + 恢复爆炸碎片 + 显示 hint */
        if(_dirGroup) _dirGroup.visible = true;
        if(typeof sparkleGroup !== 'undefined' && sparkleGroup){
          sparkleGroup.visible = true;
          // 恢复 BASE+DENSE 全开（玫瑰宫的水晶反光含大颗星芒）
          if(typeof sparkleMat !== 'undefined' && sparkleMat.uniforms.uDenseOnly){
            sparkleMat.uniforms.uDenseOnly.value = 0;
          }
          if(typeof flareSprites !== 'undefined'){
            for(const spr of flareSprites) spr.visible = true;
          }
        }
        // 恢复吊灯爆炸碎片显示
        if(typeof shardInstMeshes !== 'undefined' && shardInstMeshes && shardInstMeshes[0] && shardInstMeshes[0].inst){
          shardInstMeshes[0].inst.visible = true;
        }
        if(_dirHintEl && !allDone) _dirHintEl.classList.add('show');
      }, (_curFov2 !== null && _toFov2 !== null) ? { fromFov: _curFov2, toFov: _toFov2 } : null);
    } else {
      if(_dirGroup) _dirGroup.visible = true;
      if(typeof sparkleGroup !== 'undefined' && sparkleGroup){
        sparkleGroup.visible = true;
        if(typeof sparkleMat !== 'undefined' && sparkleMat.uniforms.uDenseOnly){
          sparkleMat.uniforms.uDenseOnly.value = 0;
        }
        if(typeof flareSprites !== 'undefined'){
          for(const spr of flareSprites) spr.visible = true;
        }
      }
      if(_dirHintEl && !allDone) _dirHintEl.classList.add('show');
    }
  }
}

/* ---------------- 点击事件 ---------------- */
let _dirSwitchingScene = false;
let _dirCurrentSceneIdx = -1;
let _dirPointerDownPos = null;

window.addEventListener('pointerdown', (e) => {
  _dirPointerDownPos = { x: e.clientX, y: e.clientY, t: performance.now() };
}, true);

window.addEventListener('pointerup', (e) => {
  const mdlG = MODELS.golestan;
  if(!mdlG || !mdlG._collapsePaused || !_dirInited) return;
  if(!_dirBigShards.length) return;
  if(_dirSwitchingScene) return;

  if(_dirPointerDownPos){
    const dx = e.clientX - _dirPointerDownPos.x;
    const dy = e.clientY - _dirPointerDownPos.y;
    const dist = Math.hypot(dx, dy);
    if(dist > 8) return;
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);

  const sprites = _dirBigShards
    .map((s, i) => (s.sprite && s.sprite.visible && i !== _dirCurrentSceneIdx) ? s.sprite : null)
    .filter(Boolean);
  const sprHits = raycaster.intersectObjects(sprites, false);
  if(sprHits.length > 0){
    const sprMesh = sprHits[0].object;
    const idx = sprMesh.userData._dirIdx;
    if(idx !== undefined && idx !== _dirCurrentSceneIdx){ openDirectoryOverlay(idx); return; }
  }
  const meshes = _dirBigShards
    .map((s, i) => (s.mesh && i !== _dirCurrentSceneIdx) ? s.mesh : null)
    .filter(Boolean);
  const mHits = raycaster.intersectObjects(meshes, false);
  if(mHits.length > 0){
    const hitMesh = mHits[0].object;
    const idx = _dirBigShards.findIndex(s => s.mesh === hitMesh);
    if(idx >= 0 && idx !== _dirCurrentSceneIdx) openDirectoryOverlay(idx);
  }
}, true);

/* ================================================================
 *  终幕：碎片化星芒 + 结语 + 落版
 *  时机：resumeCollapseFromDirectory 中烧灼完成 ~7.6s 后调用 showFinale()
 *  - 当前页面已经几乎全黑（panoBurnSphere 烧到 1.10）
 *  - 此时主场景剩余的碎片即作为"星芒"，无需再叠 canvas 星点
 *  - finale 容器只承担：黑底兜底 + 结语文案 + 落版
 * ================================================================ */
function showFinale(){
  let el = document.getElementById('finale');
  if(!el){
    el = document.createElement('div');
    el.id = 'finale';
    el.className = 'finale finale-minimal';
    el.innerHTML = ''
      + '<div class="finale-content">'
      +   '<div class="finale-block finale-block-1">'
      +     '<p>镜子碎了，光散成星。</p>'
      +     '<p class="quiet">那些来自十万片镜面、四千万块瓷砖的反光，</p>'
      +     '<p class="quiet">如今飘在无边的黑里。</p>'
      +   '</div>'
      +   '<div class="finale-block finale-block-2">'
      +     '<p>文明是一场反熵的运动。</p>'
      +     '<p>工匠铺设瓷砖，母亲教女儿打结，制琴师调试弦音——</p>'
      +     '<p class="quiet">是反熵。</p>'
      +     '<p class="quiet">战争把 18 年压成 1 秒，把秩序还原成尘。</p>'
      +   '</div>'
      +   '<div class="finale-block finale-block-3">'
      +     '<p>但碎片还在发光。</p>'
      +     '<p class="quiet">明知一切终将崩塌，仍然选择建造，</p>'
      +     '<p class="quiet">这是人类做过的最伟大的事。</p>'
      +   '</div>'
      +   '<div class="finale-block finale-block-4 finale-end">'
      +     '<div class="finale-title-zh">18 年与 1 秒</div>'
      +     '<div class="finale-title-en">18 Years and 1 Second</div>'
      +     '<div class="finale-meta">2026.02.28 — 2026.05.24</div>'
      +     '<div class="finale-meta quiet">第 86 天 · 距离第 100 天，还有 14 天</div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(el);
  }

  // 强制隐藏所有玫瑰宫 UI
  document.body.classList.add('finale-on');

  // 渐入
  requestAnimationFrame(() => {
    el.classList.add('show');
  });

  // 分段浮现文案
  const blocks = el.querySelectorAll('.finale-block');
  // 节奏比上一版收紧：5s / 11s / 18s / 28s
  const schedule = [1800, 7000, 13000, 22000];
  blocks.forEach((b, i) => {
    setTimeout(() => b.classList.add('show'), schedule[i] || 0);
  });
}

/* _startFinaleStars 已移除：sparkle 由主场景烧灼后剩余的反光与暗环境自身呈现 */
