/* sand directory_v2 2026-06-02T22:10 — finale 修复（精致SVG箭头+按钮紧贴+第三段完整）*/
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
    city:'设拉子', era:'9 世纪始建', eraEn:'EST. 9TH CENTURY',
    pano:'./assets/pano-shrine.jpg', icon:'./assets/01.png',
    short:'2026 年 4 月 6 日，设拉子石化厂爆炸冲击波导致镜面松动，圣陵因封锁缺乏维护。\n十万片镜子围绕着一座银色围栏——那是信徒与圣者之间最近的距离。如今，这个距离正在被战争拉远。',
    lines:[
      {text:'公元 9 世纪，什叶派圣裔阿里·伊本·哈姆泽长眠于此。',quiet:false},
      {text:'十二个世纪后的恺加王朝，工匠将十万片威尼斯进口的镜片切成星芒与菱形，',quiet:false},
      {text:'一寸一寸镶进穹顶——这门工艺叫 Ayeneh-kari，"把光关进镜子里"。',quiet:false},
      {text:'但镜子不是这里最神圣的东西。',quiet:true},
      {text:'穹顶正下方，有一座八角形的银色围栏，波斯语叫扎里赫。',quiet:false},
      {text:'它是信徒与圣者之间唯一的界面：人们用手指穿过银格栅的缝隙，',quiet:false},
      {text:'触摸里面的丝绒帷幔，亲吻冰凉的金属，系上写满祈愿的布条。',quiet:false},
      {text:'对什叶派信徒而言，这是他们一生中与神圣最近的时刻。',quiet:true},
      {text:'2026 年 4 月 6 日，设拉子石化厂被击中。冲击波以每秒 340 米掠过城区。',quiet:true},
      {text:'圣陵镜面出现松动，但更隐秘的损伤发生在扎里赫上——',quiet:false},
      {text:'银匠无法进入，传统药剂断供，银格栅表面开始泛起氧化的暗斑。',quiet:false},
      {text:'更重要的是，朝圣者来不了了。',quiet:true},
      {text:'扎里赫需要被触摸。那些手指的温度、嘴唇的印记、布条的重量，是它存在的意义。',quiet:false},
      {text:'信徒与圣者之间的距离，本来只有一层银格栅。2026 年，这个距离变成了整场战争。',quiet:true},
    ],
    symbol:{name:'扎里赫 · Zarih',quote:'扎里赫是用来被触摸的。当没有人能靠近它，神圣就只剩下氧化的银和落满灰尘的格栅。'} },

  { key:'aliqapu', label:'高门', en:'ALI QAPU PALACE · ISFAHAN',
    coord:'ISFAHAN · 32.65°N / 51.67°E', day:'02', title:'阿里卡普宫',
    city:'伊斯法罕', era:'1592 年', eraEn:'1592',
    pano:'./assets/pano-aliqapu.jpg', icon:'./assets/02.png',
    short:'2026 年 3 月 31 日空袭，六层木质结构位移，贴金天花板大面积脱落。\n高门之后，萨法维的国王曾接见世界。使臣们带着礼物来，带着哈塔姆首饰盒离开——每一件，25 万片碎料。',
    lines:[
      {text:'Ali Qapu，波斯语"高门"。',quiet:false},
      {text:'1592 年起，萨法维王朝的国王在这道门后接见世界：',quiet:false},
      {text:'奥斯曼的使臣，莫卧儿的商队，欧洲的传教士。',quiet:false},
      {text:'他们带着各自的礼物来，带着哈塔姆镶嵌的首饰盒离开——',quiet:true},
      {text:'那是一种需要用骆驼骨、乌木和黄铜丝拼成六角星的工艺，',quiet:false},
      {text:'每平方厘米 250 片碎料，一个首饰盒需要 25 万片。',quiet:false},
      {text:'2026 年 3 月 31 日，附近区域遭受密集打击。',quiet:true},
      {text:'宫殿六层的木质结构发生位移，贴金天花板"像枯叶一样脱落"——',quiet:false},
      {text:'这是伊斯法罕文化遗产局官员的原话。',quiet:false},
      {text:'伊斯法罕的哈塔姆工匠曾有 1200 人，他们需要花费数月完成一件作品。',quiet:true},
      {text:'现在，作坊歇业，工匠离散。',quiet:false},
      {text:'高门紧闭。没有使臣，没有礼物，',quiet:true},
      {text:'只有等待重新贴金的天花板，和不知何时能复工的手艺人。',quiet:false},
    ],
    symbol:{name:'哈塔姆 · Khatam-kari',quote:'25 万片碎料拼成一个首饰盒，一次爆炸让整座城市的工匠放下工具。战争摧毁的不只是建筑，还有建造的人。'} },

  { key:'music', label:'消失的乐声', en:'ALI QAPU MUSIC ROOM · ISFAHAN',
    coord:'ISFAHAN · 32.65°N / 51.67°E', day:'03', title:'阿里卡普宫·音乐厅',
    city:'伊斯法罕', era:'16-17 世纪', eraEn:'16TH–17TH CENTURY',
    pano:'./assets/pano-music_v2.jpg', icon:'./assets/03.png',
    short:'2026 年 3 月 31 日冲击波致穹顶声学壁龛（Tong-bori）出现微裂纹，气密性受损。\n400 年前，萨法维工匠造出世界最早的声学建筑。塞塔尔琴在这里震动，声波在石膏花瓶里来回折返。现在，没有地方可以校音了。',
    lines:[
      {text:'阿里卡普宫的第六层，没有壁画，没有镜面。',quiet:false},
      {text:'墙上密布着花瓶形状的镂空——Tong-bori，一种 400 年前的声学装置。',quiet:false},
      {text:'萨法维的工匠不懂物理公式，但他们知道：',quiet:true},
      {text:'当塞塔尔琴的四根弦在这个房间里震动，',quiet:false},
      {text:'声波会钻进每一个镂空的"花瓶"，',quiet:false},
      {text:'在石膏与空气的交界处来回折返，最后从穹顶汇聚成一个完美的共振点。',quiet:false},
      {text:'这是世界上最早的声学建筑之一。',quiet:true},
      {text:'塞塔尔，波斯语"三根弦"，是苏菲派修行者用来接近真主的乐器——',quiet:false},
      {text:'它的声音很轻，轻到只适合独奏和冥想。',quiet:false},
      {text:'2026 年 3 月 31 日，空袭的冲击波抵达这里时，已衰减到不足以震碎玻璃的程度。',quiet:true},
      {text:'但灰泥是脆弱的。文物专家在穹顶发现了肉眼难辨的微裂纹，',quiet:false},
      {text:'那些精密的声学腔体正在一点点失去气密性。',quiet:false},
      {text:'伊斯法罕的制琴师说，即使他们还能做琴，也没有地方可以校音了。',quiet:true},
    ],
    symbol:{name:'塞塔尔琴 · Setar',quote:'塞塔尔的声音很轻，轻到只适合在安静的房间里独奏。2026 年的伊朗，没有一个地方足够安静。'} },

  { key:'caravan', label:'丝路尽头', en:'AMIN OD-DOWLEH PLAZA · KASHAN',
    coord:'KASHAN · 33.98°N / 51.41°E', day:'04', title:'阿明·奥多莱商队客栈',
    city:'卡尚', era:'1863-1868 年', eraEn:'1863–1868',
    pano:'./assets/pano-caravan.jpg', icon:'./assets/04.png',
    short:'2026 年巴扎穹顶出现裂缝，商户锐减；地毯出口从 25 亿美元暴跌至不足 4000 万。\n160 年来，波斯地毯在这座蜂窝穹顶下找到买家。一张地毯，八百万个结，三年时光。一场战争，让这一切失去了买家。',
    lines:[
      {text:'恺加王朝的商人阿明·奥多莱在 1863 年建造这座客栈时，',quiet:false},
      {text:'不会想到它会成为世界上最精美的穆卡纳斯穹顶之一——',quiet:false},
      {text:'那些蜂窝状的石膏单元层层叠叠向上收拢，像一朵用数学公式折叠的花。',quiet:true},
      {text:'160 年来，这里是波斯地毯的定价中心。',quiet:false},
      {text:'大不里士的羊毛、库姆的丝线、伊斯法罕的图案，在这个穹顶下找到买家。',quiet:false},
      {text:'一张上等的波斯地毯需要一家人织三年，八百万个结，',quiet:false},
      {text:'每个结都是一次指尖与丝线的对话。',quiet:true},
      {text:'2026 年，制裁与战争双重绞杀。',quiet:true},
      {text:'地毯出口从 25 亿美元暴跌至不足 4000 万美元，80% 的织工失业。',quiet:false},
      {text:'卡尚大巴扎的穹顶出现了细微裂缝，但没有人来修——',quiet:false},
      {text:'巴扎里已经没有多少商户了。',quiet:false},
      {text:'穆卡纳斯依然完美，但它照耀的只是一座空荡的市场。',quiet:true},
    ],
    symbol:{name:'波斯地毯 · Farsh',quote:'一张地毯，八百万个结，三年时光。一场战争，九十天，让这一切失去了买家。'} },

  { key:'chehel', label:'四十柱的倒影', en:'CHEHEL SOTUN GARDEN · ISFAHAN',
    coord:'ISFAHAN · 32.66°N / 51.68°E', day:'05', title:'四十柱宫·花园',
    city:'伊斯法罕', era:'1647 年', eraEn:'1647',
    pano:'./assets/pano-chehel.jpg', icon:'./assets/05.png',
    short:'2026 年 UNESCO"波斯园林"遗产受震动影响，花园水池系统受损。\n二十根柱子倒映水中，便成了四十。波斯人在这里种下藏红花——15 万朵花，换 3 根红丝。一条海峡封锁，断了 3000 年的颜色。',
    lines:[
      {text:'波斯人从不直说"四十"，这个数字意味着"很多，多到数不清"。',quiet:false},
      {text:'四十柱宫其实只有二十根雪松木柱，',quiet:false},
      {text:'但当它们倒映在门前的水池中，便成了四十。',quiet:true},
      {text:'1647 年，萨法维王朝在这座花园里种下了他们对天堂的想象：',quiet:false},
      {text:'水池、柏树、玫瑰——还有藏红花。',quiet:false},
      {text:'波斯人称它为 Za\'feran，红色黄金。',quiet:true},
      {text:'3000 年前，大流士大帝用它染制皇袍；',quiet:false},
      {text:'1000 年前，波斯诗人用它比喻黎明的第一缕光。',quiet:false},
      {text:'今天，伊朗东北部的霍拉桑省供应着全球 90% 的藏红花。',quiet:true},
      {text:'每公斤藏红花需要手工采摘 15 万朵番红花，只取花蕊中央三根红色柱头。',quiet:false},
      {text:'一个熟练工人一天只能采集 60 克。',quiet:false},
      {text:'2026 年 3 月，霍尔木兹海峡封锁。藏红花的出口路线断了。',quiet:true},
      {text:'霍拉桑的农民还在采摘，但红色黄金堆积在仓库里，',quiet:false},
      {text:'价格飙升到每公斤 1250 美元，买家却在大洋彼岸干等。',quiet:false},
      {text:'四十柱宫的花园还在。水池倒映着柱子，柱子倒映着天空。',quiet:true},
      {text:'但那片曾经染红波斯黄昏的颜色，正在失去抵达世界的道路。',quiet:false},
    ],
    symbol:{name:'藏红花 · Saffron',quote:'15 万朵花，换 3 根红丝。一条海峡，断了 3000 年的颜色。'} },

  { key:'imam', label:'波斯蓝', en:'IMAM MOSQUE · ISFAHAN',
    coord:'ISFAHAN · 32.65°N / 51.67°E', day:'06', title:'伊玛目清真寺',
    city:'伊斯法罕', era:'1611-1629 年', eraEn:'1611–1629',
    pano:'./assets/pano-imam_v2.jpg', icon:'./assets/06.png',
    short:'2026 年双层穹顶出现结构性裂缝，蓝色釉面瓷砖持续脱落。\n18 年，4750 万块瓷砖，每一块都在窑炉中接受七种颜色的洗礼。现在，没有人知道还要掉多少块，才算"严重受损"。',
    lines:[
      {text:'1611 年，萨法维国王阿巴斯一世决定在伊斯法罕建造一座前所未有的清真寺。',quiet:false},
      {text:'他没能看到竣工——工程持续了 18 年，4750 万块瓷砖，',quiet:false},
      {text:'每一块都在窑炉中接受七种颜色的洗礼。波斯人称之为 Haft-rangi。',quiet:true},
      {text:'那种蓝，来自阿富汗巴达赫尚省的青金石矿。',quiet:false},
      {text:'商队把石头运过兴都库什山脉，工匠把它研磨成粉，',quiet:false},
      {text:'与釉料混合，在 1200 度的窑火中烧成永恒——',quiet:false},
      {text:'这是波斯人对天堂的想象：蓝得像天空落在地上的碎片。',quiet:true},
      {text:'伊玛目清真寺的穹顶是双层结构，外壳与内壳之间的空腔可以放大祈祷的回声。',quiet:false},
      {text:'这个设计让它成为世界建筑史上的奇迹——也让它成为震动的放大器。',quiet:false},
      {text:'2026 年，持续的冲击波让穹顶出现结构性裂缝。',quiet:true},
      {text:'庭院的角落里，文保人员收集到越来越多蓝色的碎片。',quiet:false},
      {text:'没有人知道还要掉多少块，才算"严重受损"。',quiet:true},
    ],
    symbol:{name:'七色瓷砖 · Haft-rangi',quote:'瓷砖上有七种颜色，但人们只数得清正在脱落的那一种。'} },

  { key:'masumeh', label:'金顶下的祈祷', en:'HAZRAT MASUMEH SHRINE · QOM',
    coord:'QOM · 34.64°N / 50.88°E', day:'07', title:'法蒂玛·马苏梅圣陵',
    city:'库姆', era:'9 世纪始建', eraEn:'EST. 9TH CENTURY',
    pano:'./assets/pano-masumeh-1_v2.jpg', icon:'./assets/07.png',
    short:'2026 年 3 月 16 日库姆周边军事化封锁，朝圣者锐减，圣陵区域受限。\n1200 年来，信徒手持念珠来到这里，33 颗珠子滑过指尖，是与真主最私密的对话。如今，念珠的原料来不了，握着它们的人也来不了了。',
    lines:[
      {text:'库姆是伊朗的精神首都。',quiet:false},
      {text:'公元 816 年，先知穆罕默德的后裔法蒂玛·马苏梅病逝于此，',quiet:false},
      {text:'她的陵墓在此后 1200 年里不断扩建，',quiet:false},
      {text:'金色穹顶成为什叶派世界最神圣的天际线之一。',quiet:true},
      {text:'信徒们带着念珠来到这里。',quiet:false},
      {text:'塔斯比赫，波斯语"赞念"。',quiet:false},
      {text:'什叶派的"法蒂玛赞念"要求信徒在每次礼拜后默诵：',quiet:true},
      {text:'"真主至大" 34 遍、"感赞真主" 33 遍、"真主清净" 33 遍——正好 100 次。',quiet:false},
      {text:'33 颗或 99 颗珠子串成一圈，每一颗滑过指尖，都是一次与真主的私语。',quiet:false},
      {text:'库姆是念珠的故乡。最尊贵的念珠用尼沙布尔的绿松石制成，',quiet:true},
      {text:'天蓝色带着棕色的铁线纹，被认为能趋吉避凶。',quiet:false},
      {text:'更神圣的材料是 Khak-e-Shifa——"治愈之土"，',quiet:false},
      {text:'取自伊拉克卡尔巴拉伊玛目侯赛因殉难的圣地。',quiet:false},
      {text:'2026 年 3 月 16 日，库姆周边道路被军事化封锁。',quiet:true},
      {text:'绿松石来自尼沙布尔——物流中断了。',quiet:false},
      {text:'圣土来自卡尔巴拉——边境关闭了。',quiet:false},
      {text:'库姆的念珠作坊，一家接一家停工。',quiet:false},
      {text:'更重要的是，朝圣者来不了了。',quiet:true},
      {text:'金顶下的祈祷厅曾经人潮涌动，现在空荡如洗。',quiet:false},
      {text:'念珠是信仰的触感。当没有人握着它，祈祷就只剩下沉默。',quiet:true},
    ],
    symbol:{name:'塔斯比赫 · Tasbih',quote:'33 颗珠子，100 次赞念。当念珠断线，信仰就失去了可以抚摸的形状。'} },

  { key:'pink', label:'粉红清真寺的早晨', en:'NASIR AL-MULK MOSQUE · SHIRAZ',
    coord:'SHIRAZ · 29.60°N / 52.55°E', day:'08', title:'莫克清真寺',
    city:'设拉子', era:'1876-1888 年', eraEn:'1876–1888',
    pano:'./assets/pano-pink.jpg', icon:'./assets/08.png',
    short:'2026 年设拉子遭受打击，同类 Orsi 彩窗建筑受损引发担忧。\n每天清晨七点，阳光穿过万花筒般的窗棂，在地毯上画满彩虹。设拉子还有另一种活的遗产——波斯猫，它们走过 400 年，从皇宫走到世界。2026 年，它们走不出设拉子了。',
    lines:[
      {text:'游客们叫它"粉红清真寺"，波斯人叫它"莫克"。',quiet:false},
      {text:'1876 年至 1888 年，恺加王朝的工匠用粉红色瓷砖和 Orsi 彩色玻璃建造了这座奇观。',quiet:false},
      {text:'每天清晨七点，阳光穿过万花筒般的窗棂，在地毯上画满彩虹。',quiet:true},
      {text:'但设拉子不只有清真寺。',quiet:false},
      {text:'这座城市还有另一种"活的文化遗产"——波斯猫。',quiet:false},
      {text:'1620 年，意大利旅行家彼得罗·德拉瓦莱从呼罗珊把第一批长毛猫带回欧洲。',quiet:true},
      {text:'在萨法维王朝的伊斯法罕宫廷，它们被称为 buraq，',quiet:false},
      {text:'只有皇室成员和高级官员才能豢养。',quiet:false},
      {text:'19 世纪恺加王朝的纳赛尔丁沙阿最宠爱的那只猫叫"巴德里汗"，配有专门的侍从。',quiet:true},
      {text:'1871 年，维多利亚女王在伦敦猫展上买下两只波斯猫，',quiet:false},
      {text:'从此这个品种风靡欧洲贵族圈。',quiet:false},
      {text:'2019 年，伊朗文化部将波斯猫列为国家文化遗产。',quiet:true},
      {text:'但 2026 年，设拉子的繁殖场陷入停滞——',quiet:false},
      {text:'国际血统登记系统中断，出口航线取消，纯种波斯猫的基因库正在萎缩。',quiet:false},
      {text:'莫克清真寺的彩色玻璃还在透光。',quiet:true},
      {text:'但那些曾经在波斯宫廷踱步的白色身影，正在慢慢失去它们的血统证明。',quiet:false},
    ],
    symbol:{name:'波斯猫 · Gorbe-ye Irāni',quote:'波斯猫走过 400 年，从皇宫走到世界。2026 年，它们走不出设拉子了。'} },

  { key:'lotfollah', label:'孔雀的尾巴', en:'SHEIKH LOTFOLLAH MOSQUE · ISFAHAN',
    coord:'ISFAHAN · 32.65°N / 51.68°E', day:'09', title:'希赫洛特夫拉清真寺',
    city:'伊斯法罕', era:'1603-1619 年', eraEn:'1603–1619',
    pano:'./assets/pano-lotfollah_v2.jpg', icon:'./assets/09.png',
    short:'2026 年 3 月 31 日穹顶瓷砖脱落，内部采光窗破碎，"孔雀开屏"光影奇观受损。\n19 万片瓷砖按数学公式排列，阳光射入时汇聚成一只正在开屏的孔雀。当瓷砖脱落，公式就错了。',
    lines:[
      {text:'这座清真寺没有宣礼塔，因为它不对公众开放。',quiet:false},
      {text:'1603 年至 1619 年，萨法维国王阿巴斯一世用 16 年时间，',quiet:false},
      {text:'为他的后宫建造了一座私人祈祷所。',quiet:false},
      {text:'穹顶是它的秘密。',quiet:true},
      {text:'19 万片马赛克瓷砖按照精密的数学公式排列，',quiet:false},
      {text:'当阳光以特定角度射入侧窗，光束会在穹顶内壁汇聚成一条金色的弧线——',quiet:false},
      {text:'像一只孔雀正在开屏的尾羽。',quiet:false},
      {text:'随着太阳移动，这只孔雀会缓缓旋转，',quiet:true},
      {text:'从奶油色变成玫瑰粉，最后消失在黄昏里。',quiet:false},
      {text:'孔雀在波斯文明中从不只是一只鸟。',quiet:true},
      {text:'萨珊王朝的石刻上，它守护在"生命之树"两侧，象征永恒。',quiet:false},
      {text:'苏菲派诗人阿塔尔在《百鸟会议》中写它是被逐出乐园的"天堂之鸟"。',quiet:false},
      {text:'纳迪尔沙从印度带回的"孔雀宝座"，成为波斯君权最耀眼的符号。',quiet:false},
      {text:'2026 年 3 月 31 日，伊斯法罕遭受空袭。',quiet:true},
      {text:'希赫洛特夫拉清真寺的穹顶出现瓷砖脱落，内部采光窗破碎。',quiet:false},
      {text:'没有人知道，当那些精确到毫米的瓷砖缺失后，阳光还能不能画出那只孔雀。',quiet:false},
      {text:'孔雀开屏需要 400 年的积累。让它合上，只需要一次震动。',quiet:true},
    ],
    symbol:{name:'波斯孔雀 · Tāvus',quote:'穹顶上的孔雀不是画出来的，是光算出来的。当瓷砖脱落，公式就错了。'} },

  { key:'miniature', label:'画中人', en:'CHEHEL SOTUN INTERIOR · ISFAHAN',
    coord:'ISFAHAN · 32.66°N / 51.68°E', day:'10', title:'四十柱宫·内部',
    city:'伊斯法罕', era:'1647 年', eraEn:'1647',
    pano:'./assets/pano-miniature.jpg', icon:'./assets/10.png',
    short:'2026 年被确认为"损失最严重"古迹；壁画大面积开裂，国王面容被裂缝贯穿，颜料层剥落；蜂窝拱顶 Muqarnas 出现错位。\n萨法维的君王、使臣、乐师、美人——他们的面容正在从墙上消失。修复需要青金石、朱砂、孔雀绿，但这三条路，现在都不通。',
    lines:[
      {text:'走进四十柱宫的深处，你会和萨法维王朝的人对视。',quiet:false},
      {text:'他们存在于细密画的笔触里。',quiet:false},
      {text:'波斯细密画是一种不留空白的艺术：',quiet:false},
      {text:'松鼠毛做成的画笔，蘸着青金石蓝、朱砂红、孔雀绿——',quiet:true},
      {text:'这些矿物颜料从丝绸之路的各个角落汇聚而来，',quiet:false},
      {text:'被画师用来填满每一寸画面。',quiet:false},
      {text:'一幅巴掌大的细密画，需要画三个月。',quiet:false},
      {text:'2020 年，波斯细密画被列入 UNESCO 非物质文化遗产名录。',quiet:true},
      {text:'四十柱宫内部的湿壁画，是这种艺术与建筑结合的最高典范：',quiet:false},
      {text:'墙上画着国王阿巴斯大帝接见乌兹别克使臣，',quiet:false},
      {text:'画着宫廷乐师弹奏塞塔尔琴，画着波斯美人斟酒——',quiet:false},
      {text:'每一个人物都有名有姓，每一个场景都是历史的切片。',quiet:true},
      {text:'2026 年，四十柱宫被确认为此次冲突中"损失最严重"的古迹。',quiet:true},
      {text:'震动让壁画的石膏基层与墙体之间出现空鼓。',quiet:false},
      {text:'一道裂缝从国王阿巴斯大帝的眉心划过，撕裂了他的面容。',quiet:false},
      {text:'蜂窝状拱顶的 Muqarnas 发生了肉眼可见的错位，',quiet:false},
      {text:'颜料层正在以每天可测量的速度剥落，',quiet:false},
      {text:'朱砂红化为粉尘，青金石蓝变成地上的碎屑。',quiet:false},
      {text:'修复细密画需要同样的矿物颜料。',quiet:true},
      {text:'但青金石来自阿富汗巴达赫尚——边境关闭了。',quiet:false},
      {text:'朱砂来自中国湖南——贸易中断了。',quiet:false},
      {text:'孔雀绿来自俄罗斯乌拉尔——制裁名单上。',quiet:false},
      {text:'三条路，现在都不通。',quiet:true},
      {text:'画中人还在微笑。但裂缝正在吞噬他们的眼睛、嘴唇和手指。',quiet:false},
      {text:'每过一天，就有更多的面容变得模糊，更多的历史变成虚无。',quiet:true},
    ],
    symbol:{name:'波斯细密画 · Miniature',quote:'细密画不留空白，因为波斯人相信空白是虚无。现在，裂缝正在把画面变成虚无。'} },
];

/* ---------------- 状态 ---------------- */
let _dirInited = false;
let _dirBigShards = [];   // [{mesh, sceneCfg, sprite, origMat, highMat, visited, ...}]
let _dirOverlayEl = null;
let _dirHintEl = null;
let _dirCueEl = null;     // 进场提示文字层："轻触任意 5 个碎片..."（点开第一片自动淡出）
let _dirGroup = null;
let _deckAutoCollapseTimer = null;

const _dirTmpV = new THREE.Vector3();

/* ---------------- 月光文字 Sprite 工厂 ---------------- */
/* 终版海报标题风（参考《脆弱的文明》）：
 *  - 字背后的「朦胧光雾」：极大半径 radial-gradient，渐隐到无明显边界
 *    （不是矩形/椭圆衬底，是一团弥散的光气）
 *  - 文字主体：纯白单色（不渐变）
 *  - 不要清晰边缘的描边、投影或框
 *  - 字体：方正丝路体 ExtraBold（webfont subset，~12KB）→ 思源宋体 → 苹方 → 系统宋体
 */

// 字体加载状态：在首批 sprite 创建时若字体还没 ready，先用 fallback 画，
// 等加载完后回调全部已生成 sprite 重绘
let _fzSiluFontReady = false;
const _pendingSpriteRedraws = [];
(function preloadFZSiLu(){
  if(typeof document === 'undefined' || !document.fonts || !document.fonts.load){
    _fzSiluFontReady = true; // 老浏览器直接当 ready，反正 fallback 也能跑
    return;
  }
  // 主动触发加载
  document.fonts.load('900 78px "FZSiLuTi"', '镜中圣陵高门消失乐声丝路尽头四十柱倒影波斯蓝金顶下祈祷粉红清真寺早晨孔雀尾巴画中人轻触吊灯').then(() => {
    _fzSiluFontReady = true;
    console.log('[font] 方正丝路体已加载，重绘', _pendingSpriteRedraws.length, '个标签');
    while(_pendingSpriteRedraws.length){
      const fn = _pendingSpriteRedraws.shift();
      try { fn(); } catch(e){ console.warn('[font] redraw failed', e); }
    }
  }).catch(err => {
    console.warn('[font] 方正丝路体加载失败，使用 fallback', err);
    _fzSiluFontReady = true;
  });
})();

function makeGoldTextSprite(text, /* 已弃用 */ _dayText){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // canvas 大幅放宽以容纳大半径朦胧光雾（不能被裁切）
  const W = 900, H = 360;
  const cv = document.createElement('canvas');
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);

  /* —— 修复 2026-05-30：sprite 横向拉伸 bug ——
   *
   *  上一版的 bug：sprite.scale.x 按文字数等比缩放（5 字 → 95，8 字 → 152），
   *    但 Three.js Sprite 永远把贴图 stretch-fit 到 sprite scale 矩形，
   *    导致长标签的 sprite 被横向"拉伸"，每个字看起来字距变宽。
   *
   *  正确做法：所有 sprite **世界 scale 完全一致**（120 × 38），
   *    canvas 里画的文字也保持完全一致的字号和字距。
   *    长标签自然占 canvas 更宽的位置，短标签居中留白。
   *    这样 10 个标签的"字号 + 字间距 + 朝向"都严格一致，没有任何拉伸。 */
  const FONT_SIZE = 64; // canvas 内字号（之前 78，这次缩小满足"字号小一点"的需求）
  const LETTER_SPACING_PX = -2; // 字间距收紧，logo 整体感

  // 实际绘制函数（首次/字体加载后均可调用）
  function paint(){
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mainY = H / 2;
    // 字体回退链：方正丝路体 → 思源宋体 Heavy → 苹方 Heavy → 系统宋体
    ctx.font = `900 ${FONT_SIZE}px "FZSiLuTi","Noto Serif SC","PingFang SC","Songti SC",serif`;
    if('letterSpacing' in ctx) ctx.letterSpacing = `${LETTER_SPACING_PX}px`;

    const cx = W / 2;
    const cy = mainY;
    const textW = ctx.measureText(text).width;

    // ============================================================
    //  Step 1: 朦胧光雾（极弱，紧贴文字。fog 半径限制在 textW 范围内）
    // ============================================================
    ctx.save();
    const fogR = textW * 0.55;
    const fog1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, fogR);
    fog1.addColorStop(0,    'rgba(255,235,205,0.30)');
    fog1.addColorStop(0.30, 'rgba(255,225,195,0.18)');
    fog1.addColorStop(0.65, 'rgba(220,210,235,0.06)');
    fog1.addColorStop(1,    'rgba(220,210,235,0)');
    ctx.fillStyle = fog1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 第二层：左右两个偏色雾斑（轻微，让光雾不死板）
    ctx.save();
    const fog2a = ctx.createRadialGradient(cx - textW * 0.30, cy - 6, 0, cx - textW * 0.30, cy, textW * 0.32);
    fog2a.addColorStop(0,    'rgba(220,215,245,0.14)');
    fog2a.addColorStop(0.6,  'rgba(220,215,245,0.04)');
    fog2a.addColorStop(1,    'rgba(220,215,245,0)');
    ctx.fillStyle = fog2a;
    ctx.fillRect(0, 0, W, H);

    const fog2b = ctx.createRadialGradient(cx + textW * 0.30, cy + 4, 0, cx + textW * 0.30, cy, textW * 0.32);
    fog2b.addColorStop(0,    'rgba(255,210,200,0.14)');
    fog2b.addColorStop(0.6,  'rgba(255,210,200,0.04)');
    fog2b.addColorStop(1,    'rgba(255,210,200,0)');
    ctx.fillStyle = fog2b;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ============================================================
    //  Step 2: 椭圆 mask 强制切除四角（保证 sprite 在深色背景上
    //         不会显出矩形边界）
    // ============================================================
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.5);
    mask.addColorStop(0,    'rgba(0,0,0,1)');
    mask.addColorStop(0.55, 'rgba(0,0,0,1)');
    mask.addColorStop(0.85, 'rgba(0,0,0,0.6)');
    mask.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ============================================================
    //  Step 3: 文字主体
    // ============================================================
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'rgba(255,235,205,0.55)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, W / 2, mainY);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillText(text, W / 2, mainY);
  }

  // 首次绘制（如果字体还没 ready，会用 fallback）
  paint();

  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  // 若字体还没 ready，注册「ready 后重绘」回调（不再需要重算 scale，因为所有 sprite scale 一致）
  if(!_fzSiluFontReady){
    _pendingSpriteRedraws.push(() => {
      paint();
      tex.needsUpdate = true;
    });
  }

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    rotation: 0,         // 显式锁定屏幕空间旋转 = 0（始终水平正面朝向镜头）
  });
  const spr = new THREE.Sprite(mat);
  /* —— 全局统一 sprite 世界 scale —— canvas 宽高比 W/H = 900/360 = 2.5，
   *    sprite scale 也保持同样比例 (120, 48)，避免贴图被任何方向拉伸。
   *    所有 10 个标签世界 scale 完全相同，文字渲染在 canvas 内居中，
   *    长标签字多但每个字字号/字距与短标签完全一致 → 视觉一致性。 */
  const SCALE_W = 120;
  const SCALE_H = 48; // = 120 / (900/360) = 120 / 2.5 = 48 → 严格匹配 canvas 宽高比，无拉伸
  spr.scale.set(SCALE_W, SCALE_H, 1);
  spr.userData._dirIsLabel = true;
  spr.userData._dirBaseScale = { x: SCALE_W, y: SCALE_H };
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
    /* _directoryVisitedOrder：按"访问顺序"记录访问过的 idx，最多 DIRECTORY_TRIGGER_COUNT 个。
     * 槽位 0..4 严格按这个顺序填，第 6+ 个访问的场景不计入收藏册（5/5 已满）。 */
    mdlG._directoryVisitedOrder = [];

    // —— 关键：进入目录态时，把镜厅崩坏卡（storyEl）彻底藏掉 + 清空 inner，
    //   否则崩坏阶段输出的 card-title("德黑兰·古列斯坦宫") + card-subtitle(经纬度)
    //   会一直飘在目录页画面顶部。
    if(typeof storyEl !== 'undefined' && storyEl){
      storyEl.classList.remove('show');
      storyEl.classList.remove('collapse-story');
      const _innerEl = storyEl.querySelector('.story-card-inner');
      if(_innerEl) _innerEl.innerHTML = '';
      mdlG._collapseStoryActive = false;
    }

    if(mdlG._nextHintTimeout){ clearTimeout(mdlG._nextHintTimeout); mdlG._nextHintTimeout = null; }
    if(mdlG._collapseTimeout){ clearTimeout(mdlG._collapseTimeout); mdlG._collapseTimeout = null; }

    if(typeof autoRotateSpeed !== 'undefined'){
      autoRotateSpeed = AUTO_ROTATE_BOOST_SETTLE * 0.4;
      _autoRotateBoostStart = 0;
    }

    setupDirectoryFragments();

    /* 预加载所有子场景全景图到 panoTextures 缓存
     * 否则用户点击碎片时要等 1~2s 网络加载，autoRotate 期间画面继续转，
     * 火焰开始时已经偏离了用户点击瞬间的视角，造成"先跳到固定角度才烧"的错觉 */
    if(typeof DIR_PANO_MAP !== 'undefined' && typeof _ensurePanoLoaded === 'function'){
      Object.keys(DIR_PANO_MAP).forEach(key => {
        try { _ensurePanoLoaded(DIR_PANO_MAP[key], 'dir_' + key); } catch(_){}
      });
      console.log('[directory] 预加载', Object.keys(DIR_PANO_MAP).length, '张子场景全景图');
    }

    console.log('[directory] 爆炸定格 → 进入目录态');
  } catch(e){
    console.error('[directory] pauseCollapseForDirectory 抛错:', e && e.message, e && e.stack && e.stack.split('\n')[1]);
  }
}

/* ---------------- 终幕序章：爆炸前的两行字提示 ----------------
 * 节奏（总 ~4.4s）：
 *   0.0s   插入 DOM，容器开始淡入（0.8s）
 *   1.0s   第一行"五片碎光，已在你手中。" 淡入（1.1s）
 *   2.2s   第二行"现在，把它还给夜空。" 淡入（1.1s）
 *   3.4s   两行同时开始变暗（dim 0.35）
 *   3.5s   容器开始淡出（1.0s）
 *   4.3s   触发 resumeCollapseFromDirectory（爆炸点）
 *   4.5s   DOM 清理
 */
function _runFinalePreludeAndIgnite(){
  const mdlG = MODELS.golestan;
  // —— 埋点：到达尾声页 PV（5 个碎片全部点完，触发尾声序章） ——
  try{ if(typeof window.__report === 'function') window.__report('finale_reach'); }catch(e){}
  // 创建容器
  let el = document.getElementById('finalePrelude');
  if(!el){
    el = document.createElement('div');
    el.id = 'finalePrelude';
    el.className = 'finale-prelude';
    el.innerHTML = ''
      + '<div class="pl-line pl-line-1">5处微光，已被重新看见。</div>'
      + '<div class="pl-line pl-line-2">现在，把它还给夜空。</div>';
    document.body.appendChild(el);
  }
  const line1 = el.querySelector('.pl-line-1');
  const line2 = el.querySelector('.pl-line-2');

  // 防重入：连续触发时（极端 case）清掉旧 timer
  if(mdlG._preludeTimers){
    mdlG._preludeTimers.forEach(t => clearTimeout(t));
  }
  mdlG._preludeTimers = [];
  const _T = (fn, ms) => mdlG._preludeTimers.push(setTimeout(fn, ms));

  // 0.0s 容器淡入
  requestAnimationFrame(() => el.classList.add('show'));

  // 1.0s 第一行淡入
  _T(() => { if(line1) line1.classList.add('show'); }, 1000);
  // 2.2s 第二行淡入
  _T(() => { if(line2) line2.classList.add('show'); }, 2200);
  // 4.4s 文字开始变暗（"消散感"）—— 用户反馈整段看不完，停留期 +1s
  _T(() => {
    if(line1) line1.classList.add('dim');
    if(line2) line2.classList.add('dim');
  }, 4400);
  // 4.5s 容器整体淡出
  _T(() => { el.classList.add('fade-out'); }, 4500);
  // 5.3s 文字几乎消失的瞬间 = 爆炸
  _T(() => {
    if(mdlG._collapsePaused) resumeCollapseFromDirectory();
  }, 5300);
  // 5.6s DOM 清理（爆炸已启动 0.3s，前景的余韵也已淡到几乎不可见）
  _T(() => {
    if(el && el.parentNode) el.parentNode.removeChild(el);
  }, 5600);
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

  /* —— 终幕尘埃由 dustPoints 系统（碎片爆炸时已创建，跟相机球壳回卷）独家负责 ——
   * 不再启用 ambient 的 cosmos 模式：它是固定球壳 + vs 正弦抖动，与相机/碎片轨迹"各是各的"。
   * dustPoints 才是真正"和全景图、吊灯、碎片在同一空间"的尘埃系统。
   * 这里只保证 ambient 不会显示出来与 dustPoints 撞车。 */
  if(typeof ambient !== 'undefined' && ambient && typeof ambMat !== 'undefined' && ambMat){
    ambient.visible = false;
    ambMat.uniforms.uSunMode.value = 0.0;
    ambMat.uniforms.uCosmosMode.value = 0.0;
    window._ambTargetOpacity = 0.0;
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

  // 挑全部 10 块碎片（视觉饱满）。任何一块被访问都会按"访问顺序"填入收藏册槽位，
  // 直到 5 个槽位填满；之后再访问的场景仍可看，但不再追加到收藏册。
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
    updateFragmentDeck({ initial: true });
  }

  // —— 进场提示文字（淡入；点开第一片碎片后自动淡出） ——
  if(!_dirCueEl){
    _dirCueEl = document.createElement('div');
    _dirCueEl.id = 'dirCueText';
    _dirCueEl.className = 'dir-cue-text';
    _dirCueEl.innerHTML = '轻触<strong class="dir-cue-em">任意5个碎片</strong><br>让文明的光，在黯淡之前<br>再璀璨一次';
    document.body.appendChild(_dirCueEl);
  }
  // 延迟 600ms 淡入，让标签 sprite 先逐个浮出，再出文字（不打扰）
  setTimeout(() => {
    if(_dirCueEl && _dirInited) _dirCueEl.classList.add('show');
  }, 600);

  _dirInited = true;
  console.log('[directory] 挑出', _dirBigShards.length, '块大碎片（FPS 散开）');
}

/* ---------------- 每帧更新：星辰呼吸 ---------------- */
/* 把所有标签 sprite "拉"到以相机为中心、半径 DIR_LABEL_RING 的球面上：
 *   方向 = 碎片 worldCenter 相对相机的方向（保持"指向哪块碎片"的视觉关系）
 *   距离 = 固定 DIR_LABEL_RING
 * 这样所有标签距相机一样远，屏幕字号自然一致，没有近大远小的问题。
 * 点击仍然准确（sprite 在屏幕投影位置 = 碎片在屏幕投影位置 → raycaster 命中相同）。
 * 副作用：sprite 会随相机移动跟着"漂"，但每帧 lerp 锁定，看起来就是稳定地浮在那里。 */
const DIR_LABEL_RING = 175;      // 标签到相机的固定距离（单位：场景世界单位）
                                 // 越大字号越小。从 140 → 175，字号缩小约 20%
const DIR_LABEL_Y_OFFSET = 6;    // 在碎片方向上方一点点，避免遮住碎片本身

const _tmpDirLabelVec = new THREE.Vector3();

function updateDirectoryFragments(time){
  if(!_dirInited) return;
  const now = performance.now();
  const hasCam = (typeof camera !== 'undefined' && !!camera);
  for(let i = 0; i < _dirBigShards.length; i++){
    const item = _dirBigShards[i];
    const mesh = item.mesh;
    if(!mesh) continue;

    if(item.sprite && item.sprite.material){
      const dt = (now - item._appearStart) / 600;
      const fadeIn = Math.max(0, Math.min(1, dt));

      // —— 关键：把 sprite 位置拉到"相机 → 碎片方向"距离固定 DIR_LABEL_RING 处 ——
      // 这让所有标签距相机一样远，屏幕字号一致。
      if(hasCam && item.worldCenter){
        _tmpDirLabelVec.copy(item.worldCenter).sub(camera.position);
        const len = _tmpDirLabelVec.length();
        if(len > 0.001){
          _tmpDirLabelVec.multiplyScalar(DIR_LABEL_RING / len);
          item.sprite.position.copy(camera.position).add(_tmpDirLabelVec);
          item.sprite.position.y += DIR_LABEL_Y_OFFSET;
        }
      }

      if(item.visited){
        item.sprite.material.opacity = fadeIn * 0.42;
        item.sprite.material.rotation = 0; // 强制屏幕空间旋转 = 0（永远水平正对镜头）
        const base = item.sprite.userData._dirBaseScale;
        if(base) item.sprite.scale.set(base.x * 0.95, base.y * 0.95, 1);
      } else {
        // —— 只保留慢呼吸闪烁：opacity 0.7~1.0，无尖脉冲，无大小跳动 ——
        const phase = time * 2.4 + i * 1.7;
        const breath = (Math.sin(phase) * 0.5 + 0.5);   // 0~1
        const opacity = 0.70 + breath * 0.30;
        item.sprite.material.opacity = fadeIn * opacity;
        item.sprite.material.rotation = 0; // 强制屏幕空间旋转 = 0（永远水平正对镜头）
        const base = item.sprite.userData._dirBaseScale;
        if(base) item.sprite.scale.set(base.x, base.y, 1);
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
  if(_dirCueEl) _dirCueEl.classList.remove('show');
  if(_deckAutoCollapseTimer){
    clearTimeout(_deckAutoCollapseTimer);
    _deckAutoCollapseTimer = null;
  }
  if(_dirHintEl) _dirHintEl.classList.remove('expanded');
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
/**
 * 刷新「碎片收藏册」状态
 * @param {object} [opts]
 * @param {boolean} [opts.initial]        - 首次显示（重置所有槽位为 ?）
 * @param {number}  [opts.justPickedIdx]  - 刚拾起的索引（高亮闪烁）
 * @param {boolean} [opts.autoExpand]     - 拾起后自动展开 3s
 */
function updateFragmentDeck(opts){
  if(!_dirHintEl || !_dirHintEl._refs) return;
  opts = opts || {};
  const refs = _dirHintEl._refs;

  const mdlG = (typeof MODELS !== 'undefined') ? MODELS.golestan : null;
  const done = (mdlG && mdlG._directoryDoneCount) || 0;
  const total = DIRECTORY_TRIGGER_COUNT;
  const allDone = done >= total;

  // 顶部数字
  if(refs.done) refs.done.textContent = done;

  // 收起态文案：始终显示 "n / 5"，满 5 个时数字保持高亮（CSS 处理）
  const barText = _dirHintEl.querySelector('.deck-bar-text');
  if(barText){
    barText.innerHTML = '<b class="deck-bar-done">' + done + '</b><span class="deck-bar-sep">/</span>' + total;
    refs.done = _dirHintEl.querySelector('.deck-bar-done');
  }
  // 满 5 个：药丸整体加 .all-done class（CSS 控制颜色脉动等）
  _dirHintEl.classList.toggle('all-done', allDone);

  // 槽位状态：按"访问顺序"填，槽位 i 对应第 i 个被访问的场景（不是 DIRECTORY_SCENES[i]）
  const visitedOrder = (mdlG && mdlG._directoryVisitedOrder) || [];
  let visitedCount = 0;
  refs.slots.forEach((btn) => {
    const slotIdx = parseInt(btn.getAttribute('data-idx'), 10);
    // 这个槽位对应的"被访问场景"在 DIRECTORY_SCENES 中的 idx（若该槽位还未填则为 undefined）
    const sceneIdx = visitedOrder[slotIdx];
    const cfg = (sceneIdx !== undefined) ? DIRECTORY_SCENES[sceneIdx] : null;
    const visited = !!cfg;
    if(visited) visitedCount++;
    const iconEl = btn.querySelector('.deck-slot-icon');
    const labelEl = btn.querySelector('.deck-slot-label');

    if(opts.initial){
      // 重置：清掉之前可能挂的内容
      // 注意：未拾起的"?"槽位也要可点击 → 随机跳一个未访问场景（避免来回退回主页）
      btn.disabled = false;
      btn.classList.remove('visited', 'just-picked');
      btn.classList.add('random');
      btn.setAttribute('aria-label', '随机拾起一个新碎片');
      iconEl.innerHTML = '<span class="deck-slot-q">?</span>';
      if(labelEl) labelEl.textContent = '未拾起';
      // 记录该槽位对应的场景 idx（供点击回跳使用），未填则清掉
      btn.removeAttribute('data-scene-idx');
      return;
    }

    if(visited){
      btn.disabled = false;
      btn.classList.add('visited');
      btn.classList.remove('random');
      btn.setAttribute('aria-label', '回到「' + cfg.label + '」');
      btn.setAttribute('data-scene-idx', String(sceneIdx));
      // 只在第一次切换为 visited 时替换为 icon
      if(!iconEl.querySelector('img')){
        iconEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = cfg.icon;
        img.alt = cfg.label;
        img.draggable = false;
        iconEl.appendChild(img);
      } else {
        // 槽位重新分配（不应该发生，但保险一下：确保 src 与当前场景匹配）
        const existing = iconEl.querySelector('img');
        if(existing && !existing.src.endsWith(cfg.icon.replace('./', ''))){
          existing.src = cfg.icon;
          existing.alt = cfg.label;
        }
      }
      if(labelEl) labelEl.textContent = cfg.label;
    } else {
      // 槽位还未被填：保持"?"未拾起态，但允许点击随机跳一个未访问场景
      btn.disabled = false;
      btn.classList.remove('visited');
      btn.classList.add('random');
      btn.setAttribute('aria-label', '随机拾起一个新碎片');
      if(!iconEl.querySelector('.deck-slot-q')){
        iconEl.innerHTML = '<span class="deck-slot-q">?</span>';
      }
      if(labelEl) labelEl.textContent = '未拾起';
      btn.removeAttribute('data-scene-idx');
    }

    // 高亮"刚拾起"动画（按槽位 idx 触发，而不是场景 idx）
    if(typeof opts.justPickedSlotIdx === 'number' && slotIdx === opts.justPickedSlotIdx){
      btn.classList.remove('just-picked');
      // 强制 reflow 触发动画重播
      void btn.offsetWidth;
      btn.classList.add('just-picked');
    }
  });

  // 自动展开 3s 后收起（仅拾起时触发，且已有了自动收起 timer 则覆盖）
  if(opts.autoExpand){
    _dirHintEl.classList.add('expanded');
    if(_deckAutoCollapseTimer) clearTimeout(_deckAutoCollapseTimer);
    _deckAutoCollapseTimer = setTimeout(() => {
      if(_dirHintEl) _dirHintEl.classList.remove('expanded');
      _deckAutoCollapseTimer = null;
    }, 3000);
  }
  console.log('[deck] update: done=', done, ' slotsLit=', visitedCount, ' shardsLen=', _dirBigShards.length);
}

function ensureDirectoryDom(){
  if(!_dirHintEl){
    /* 「碎片收藏册」 —— 替代旧的顶部小条
     * 结构：
     *   #fragmentDeck
     *     .deck-bar        （收起态：进度文案 + 展开按钮）
     *     .deck-panel      （展开态：5 个槽位 + 提示语）
     */
    _dirHintEl = document.createElement('div');
    _dirHintEl.id = 'fragmentDeck';
    _dirHintEl.className = 'fragment-deck';

    // 取前 N 个场景作为目标槽位
    const slots = DIRECTORY_SCENES.slice(0, DIRECTORY_TRIGGER_COUNT);

    let slotsHtml = '';
    for(let i = 0; i < slots.length; i++){
      // 数据属性 data-idx 指向 DIRECTORY_SCENES 中的索引（也是 _dirBigShards 的索引）
      slotsHtml += '<button class="deck-slot random" data-idx="' + i + '" aria-label="随机拾起一个新碎片">'
                +    '<span class="deck-slot-icon"><span class="deck-slot-q">?</span></span>'
                +    '<span class="deck-slot-label">未拾起</span>'
                +  '</button>';
    }

    _dirHintEl.innerHTML = ''
      + '<div class="deck-bar" role="button" tabindex="0" aria-label="展开碎片收藏册">'
      +   '<span class="deck-bar-dot"></span>'
      +   '<span class="deck-bar-text"><b class="deck-bar-done">0</b><span class="deck-bar-sep">/</span>' + DIRECTORY_TRIGGER_COUNT + '</span>'
      + '</div>'
      + '<div class="deck-panel">'
      +   '<div class="deck-panel-title">碎片收藏册  ·  点亮的图标可重返场景</div>'
      +   '<div class="deck-slots">' + slotsHtml + '</div>'
      + '</div>';

    document.body.appendChild(_dirHintEl);

    // —— 交互绑定 ——
    const bar = _dirHintEl.querySelector('.deck-bar');
    const togglePanel = (forceState) => {
      const willExpand = (typeof forceState === 'boolean')
        ? forceState
        : !_dirHintEl.classList.contains('expanded');
      _dirHintEl.classList.toggle('expanded', willExpand);
      // 用户手动操作后清掉自动收起 timer，避免冲突
      if(_deckAutoCollapseTimer){
        clearTimeout(_deckAutoCollapseTimer);
        _deckAutoCollapseTimer = null;
      }
    };
    bar.addEventListener('click', () => togglePanel());
    bar.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); togglePanel(); }
    });

    // 槽位点击：
    //   - visited：切回该场景（走完整火焰过渡）
    //   - random（"?"未拾起）：从所有未访问场景里随机挑一个，避免用户必须退回主页才能拾下一片
    _dirHintEl.querySelectorAll('.deck-slot').forEach((btn) => {
      btn.addEventListener('click', () => {
        if(btn.disabled) return;

        let idx;
        if(btn.classList.contains('random')){
          // 收集所有未访问、且不是当前场景的碎片 idx
          const candidates = _dirBigShards
            .map((s, i) => (s && !s.visited && i !== _dirCurrentSceneIdx) ? i : -1)
            .filter(i => i >= 0);
          if(candidates.length === 0){
            console.log('[deck] random click: 已无未访问场景可跳');
            return;
          }
          idx = candidates[Math.floor(Math.random() * candidates.length)];
          console.log('[deck] random click → 随机选中 idx=', idx, ' 候选数=', candidates.length);
        } else {
          // 槽位实际指向的场景 idx 存在 data-scene-idx（按访问顺序绑定）
          const sceneAttr = btn.getAttribute('data-scene-idx');
          if(sceneAttr === null) return;
          idx = parseInt(sceneAttr, 10);
          if(isNaN(idx)) return;
        }

        // 已是当前场景就忽略
        if(idx === _dirCurrentSceneIdx) return;
        // 切场景前主动收起面板，避免遮挡
        _dirHintEl.classList.remove('expanded');
        // openDirectoryOverlay 内部包含火焰过渡 + 卡片展示
        openDirectoryOverlay(idx);
      });
    });

    // 暴露引用给后续刷新逻辑
    _dirHintEl._refs = {
      bar: bar,
      done: _dirHintEl.querySelector('.deck-bar-done'),
      slots: _dirHintEl.querySelectorAll('.deck-slot'),
    };
  }
  if(!_dirOverlayEl){
    _dirOverlayEl = document.createElement('div');
    _dirOverlayEl.id = 'dirOverlay';
    _dirOverlayEl.className = 'dir-overlay';
    _dirOverlayEl.innerHTML = ''
      + '<div class="dir-overlay-bg"></div>'
      /* —— 长文案的关闭 × 按钮：挂在 overlay 直接子级（永远固定屏幕右上，不随长文案内容滚动） —— */
      + '<button class="dir-overlay-close" aria-label="close">'
      +   '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>'
      + '</button>'
      /* —— 简短卡（默认显示，靠下，不挡视线） —— */
      + '<div class="dir-overlay-mini">'
      +   '<button class="dir-mini-close" aria-label="close">'
      +     '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>'
      +   '</button>'
      +   '<img class="dir-mini-icon" alt="">'
      +   '<div class="dir-mini-text">'
      +     '<div class="dir-mini-label"></div>'
      +     '<div class="dir-mini-subtitle"></div>'
      +     '<div class="dir-mini-short"></div>'
      +   '</div>'
      +   '<button class="dir-mini-expand">查看碎片故事 <span>›</span></button>'
      + '</div>'
      /* —— 完整卡（点"查看碎片故事"后展开） —— */
      + '<div class="dir-overlay-card">'
      +   '<div class="dir-overlay-en"></div>'
      +   '<div class="dir-overlay-title"></div>'
      +   '<div class="dir-overlay-coord"></div>'
      +   '<div class="dir-overlay-archive">'
      +     '<div class="dir-overlay-archive-meta"></div>'
      +     '<div class="dir-overlay-archive-damage"></div>'
      +   '</div>'
      +   '<div class="dir-overlay-lines"></div>'
      +   '<div class="dir-overlay-symbol">'
      +     '<img class="dir-overlay-symbol-img" alt="">'
      +     '<div class="dir-overlay-symbol-text">'
      +       '<div class="dir-overlay-symbol-name"></div>'
      +       '<div class="dir-overlay-symbol-quote"></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="dir-overlay-footer" role="button" tabindex="0" aria-label="收起">'
      +     '<svg class="dir-overlay-footer-arrow" viewBox="0 0 24 24" aria-hidden="true">'
      +       '<path d="M6 14l6-6 6 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      +     '</svg>'
      +     '<span class="dir-overlay-footer-text">收起</span>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(_dirOverlayEl);
    /* —— 所有浮层按钮：在 pointerdown/pointerup 阶段 stopPropagation，
     *   防止冒泡到 window 上的 raycaster 监听器（pointerup capture 那条已加 closest 兜底，
     *   但 stopPropagation 是更早一层防御）。 */
    var _stopPtr = (el) => {
      if(!el) return;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('pointerup',   (e) => e.stopPropagation());
    };
    var _bgEl = _dirOverlayEl.querySelector('.dir-overlay-bg');
    var _closeEl = _dirOverlayEl.querySelector('.dir-overlay-close');
    var _miniCloseEl = _dirOverlayEl.querySelector('.dir-mini-close');
    var _expandEl = _dirOverlayEl.querySelector('.dir-mini-expand');
    _bgEl.addEventListener('click', closeDirectoryOverlay);
    _closeEl.addEventListener('click', collapseDirectoryCard);
    _miniCloseEl.addEventListener('click', closeDirectoryOverlay);
    _expandEl.addEventListener('click', expandDirectoryCard);
    _stopPtr(_bgEl);
    _stopPtr(_closeEl);
    _stopPtr(_miniCloseEl);
    _stopPtr(_expandEl);
    /* —— 长文案底部"↑ 收起"：点击直接折回短文案（mini 卡），不关闭整层 —— */
    var _footerEl = _dirOverlayEl.querySelector('.dir-overlay-footer');
    if(_footerEl){
      _footerEl.addEventListener('click', collapseDirectoryCard);
      _footerEl.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          collapseDirectoryCard();
        }
      });
      _stopPtr(_footerEl);
    }
    // 图标也可点击 → 跳转长文案（与"查看碎片故事"按钮等价）
    var _miniIconEl = _dirOverlayEl.querySelector('.dir-mini-icon');
    if(_miniIconEl){
      _miniIconEl.style.cursor = 'pointer';
      _miniIconEl.addEventListener('click', expandDirectoryCard);
      _stopPtr(_miniIconEl);
    }
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
  music:     './assets/pano-music_v2.jpg',
  caravan:   './assets/pano-caravan.jpg',
  chehel:    './assets/pano-chehel.jpg',
  imam:      './assets/pano-imam_v2.jpg',
  masumeh:   './assets/pano-masumeh-1_v2.jpg',
  pink:      './assets/pano-pink.jpg',
  lotfollah: './assets/pano-lotfollah_v2.jpg',
  miniature: './assets/pano-miniature.jpg',
};

var DIR_HOME_PANO_URL = './golestan_360.jpg';

/* ---------------- 填充 + 打开/关闭浮层 ---------------- */
function _fillDirOverlayContent(cfg){
  // —— 拆分 short 字段：原格式 "受损：xxx\n引导句"
  //    mini 卡只展示引导句；完整卡只展示"受损"那行（避免与 mini 卡重复）
  var _shortRaw = cfg.short || '';
  var _shortParts = _shortRaw.split('\n');
  var _damageLine = '';   // 第一行（受损：xxx），可能为空
  var _hookLine   = '';   // 引导句（最后一段），用于 mini 卡
  if(_shortParts.length >= 2){
    _damageLine = _shortParts[0].trim();
    _hookLine   = _shortParts.slice(1).join('\n').trim();
  } else {
    _hookLine = _shortRaw.trim();
  }

  // —— 简短卡（参考镜厅 .story-card 留白美学：标题 / 副标题 / 引导句 三层）
  //    第 1 行：地点 · 场景 · 年代（card-title 风格 · 中字距）
  //    第 2 行：英文坐标 · day 0x（card-subtitle 风格 · 大字距 · 装饰）
  //    第 3+ 行：引导句（p 风格）
  const miniIcon  = _dirOverlayEl.querySelector('.dir-mini-icon');
  const miniLabel = _dirOverlayEl.querySelector('.dir-mini-label');
  const miniSub   = _dirOverlayEl.querySelector('.dir-mini-subtitle');
  const miniShort = _dirOverlayEl.querySelector('.dir-mini-short');
  if(cfg.icon){ miniIcon.src = cfg.icon; miniIcon.style.display = ''; }
  else { miniIcon.style.display = 'none'; }
  // mini 标题：纯地名（如"阿里·伊本·哈姆泽圣陵"）
  miniLabel.textContent = cfg.title || cfg.label;
  // mini 副标题：英文坐标 · 英文年代（装饰，单行，小字号）
  miniSub.textContent = cfg.eraEn ? (cfg.coord + '  ·  ' + cfg.eraEn) : cfg.coord;
  // mini 正文：仅引导句
  miniShort.textContent = _hookLine;
  // —— 坐标行超长自适应：若 scrollWidth > clientWidth，按比例缩字号（兜底 CSS clamp 之外的极端情况）
  requestAnimationFrame(() => {
    try {
      // 重置之前可能写入的 inline 样式，重新测量
      miniSub.style.fontSize = '';
      miniSub.style.letterSpacing = '';
      const sw = miniSub.scrollWidth;
      const cw = miniSub.clientWidth;
      if(sw > cw && cw > 0){
        const ratio = cw / sw;
        const cur = parseFloat(getComputedStyle(miniSub).fontSize) || 11;
        // 按比例缩，并对字距做更激进的收紧；不低于 8px
        const next = Math.max(8, cur * ratio * 0.98);
        miniSub.style.fontSize = next.toFixed(2) + 'px';
        miniSub.style.letterSpacing = '0.4px';
      }
    } catch(e){ /* noop */ }
  });

  // —— 完整卡（去重版：mini 卡已展示过的内容不再重复）
  //    保留：英文名（装饰，单行小字）+ 正式名 + 受损 + 叙事 lines + symbol
  //    去掉：coord（已在 mini 副标题）+ archive-meta（已在 mini 标题）+ 引导句
  _dirOverlayEl.querySelector('.dir-overlay-en').textContent = cfg.en;
  _dirOverlayEl.querySelector('.dir-overlay-title').textContent = cfg.label;
  // 隐藏冗余元素
  var _coordEl = _dirOverlayEl.querySelector('.dir-overlay-coord');
  if(_coordEl) _coordEl.style.display = 'none';
  var _archMeta = _dirOverlayEl.querySelector('.dir-overlay-archive-meta');
  if(_archMeta) _archMeta.style.display = 'none';
  // 受损情况：保留在档案带
  const archiveDamage = _dirOverlayEl.querySelector('.dir-overlay-archive-damage');
  archiveDamage.textContent = _damageLine;
  archiveDamage.style.display = _damageLine ? '' : 'none';
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
  // —— 埋点：用户主动点击「查看碎片故事」展开长文案（每个碎片独立 PV） ——
  try{
    if(typeof window.__report === 'function'){
      var _curIdx = _dirCurrentSceneIdx;
      var _curItem = (_curIdx >= 0 && _dirBigShards) ? _dirBigShards[_curIdx] : null;
      var _curCfg = _curItem ? _curItem.sceneCfg : null;
      window.__report('fragment_expand', {
        fragmentKey: (_curCfg && _curCfg.key) || ('idx_' + _curIdx),
        fragmentLabel: (_curCfg && _curCfg.label) || ''
      });
    }
  }catch(e){}
  /* —— 修复 2026-06-02：每次展开长文案，强制从顶部开始显示 ——
   * 因为 .dir-overlay-card 是 overflow-y:auto 的滚动容器、且 DOM 节点常驻，
   * 上一次看完未到底就关闭、再打开同一/不同碎片时，浏览器会保留上次 scrollTop，
   * 表现为"有的页面打开就在底部"。强制把滚动位置归零（容器 + 所有可滚动子项兜底）。 */
  const cardEl = _dirOverlayEl.querySelector('.dir-overlay-card');
  if(cardEl){
    cardEl.scrollTop = 0;
    /* 双 RAF 兜底：等 DOM 切到 expanded 真正可见、布局就绪后再归零一次，
     * 防止 transition / 动画期间被异步重新计算回到旧值。 */
    requestAnimationFrame(() => {
      cardEl.scrollTop = 0;
      requestAnimationFrame(() => { cardEl.scrollTop = 0; });
    });
  }
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
  console.log('[directory] openDirectoryOverlay idx=', idx, 'cfg.key=', cfg.key, 'label=', cfg.label, '_dirCurrentSceneIdx=', _dirCurrentSceneIdx);

  // —— 埋点：点击碎片（每个碎片独立 PV，参数 fragmentKey 区分是哪片碎片） ——
  try{
    if(typeof window.__report === 'function'){
      window.__report('fragment_open', {
        fragmentKey: cfg.key || ('idx_' + idx),
        fragmentLabel: cfg.label || ''
      });
    }
  }catch(e){}

  _dirSwitchingScene = true;
  _dirCurrentSceneIdx = idx;

  /* 点击第一个碎片即开始淡出"轻触…"提示文字（之前要等 mini 卡出现才隐藏，
   * 火焰过渡那 1~2s 期间提示一直亮着，用户体感"还在提示我点"） */
  if(_dirCueEl) _dirCueEl.classList.remove('show');

  /* 点击瞬间立即冻结自动旋转
   * 否则全景图加载耗时（首屏 1~2s）期间，画面会继续 autoRotate 转动，
   * 等图加载完火焰才出现 → 用户感受为"先转到某个视角再开始烧灼" */
  if(typeof autoRotateActive !== 'undefined') autoRotateActive = false;
  if(typeof _lastUserInteractTime !== 'undefined') _lastUserInteractTime = 0;

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
      // 关闭 BaseOnly（镜中圣陵需要 5000 颗小光球）
      if(typeof sparkleMat !== 'undefined' && sparkleMat.uniforms.uBaseOnly){
        sparkleMat.uniforms.uBaseOnly.value = 0;
      }
      // 同时隐藏 flareSprites（八角星芒贴图，水晶专属，不适合镜面）
      if(typeof flareSprites !== 'undefined'){
        for(const spr of flareSprites) spr.visible = false;
      }
    } else {
      sparkleGroup.visible = false;
    }
  }

  /* —— 子场景"环境尘埃" ambient 控制 ——
   * pink（粉红清真寺的早晨）：启用"阳光下尘埃"模式（暖金+粉玫瑰，光柱感）
   * 其他子场景：隐藏 ambient（保持画面干净，不抢戏）
   * —— 此处即时切，但 opacity 由 ambMat 的 uOpacityScale 控制，让它"随火焰一起浮现"
   *    具体淡入：3s 火焰过渡内，由主循环渐变 uOpacityScale 0→1（在 app.js 每帧 lerp）。 */
  if(typeof ambient !== 'undefined' && ambient && typeof ambMat !== 'undefined' && ambMat){
    if(cfg.key === 'pink'){
      ambient.visible = true;
      ambMat.uniforms.uSunMode.value = 1.0;       // 切到阳光尘埃模式
      ambMat.uniforms.uCosmosMode.value = 0.0;
      if(typeof window._setAmbientLayout === 'function') window._setAmbientLayout('sun');
      // 起步透明，让主循环的目标值（_ambTargetOpacity = 1）把它平滑拉上来
      if(typeof window._ambTargetOpacity === 'undefined' || window._ambTargetOpacity < 0.01){
        ambMat.uniforms.uOpacityScale.value = 0.0;
      }
      window._ambTargetOpacity = 1.0;
    } else {
      // 非 pink 子场景：让 ambient 平滑淡出（避免瞬隐造成视觉突变）
      window._ambTargetOpacity = 0.0;
      ambMat.uniforms.uSunMode.value = 0.0;
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
    /* 收藏册逻辑（与 5 个槽位严格对应）：
     *   - 前 5 个被访问的场景按"访问顺序"填入槽位 0..4；
     *   - 第 6 个及以后只是看一下子场景，不再追加到收藏册（5/5 已满）。
     * 用 _directoryVisitedOrder 数组记录顺序，updateFragmentDeck 据此渲染槽位。 */
    mdlG._directoryVisitedOrder = mdlG._directoryVisitedOrder || [];
    if(mdlG._directoryVisitedOrder.length < DIRECTORY_TRIGGER_COUNT){
      mdlG._directoryVisitedOrder.push(idx);
      mdlG._directoryDoneCount = mdlG._directoryVisitedOrder.length;
      const slotIdx = mdlG._directoryVisitedOrder.length - 1; // 刚填入的槽位号
      console.log('[deck] visited idx=', idx, ' label=', cfg.label,
                  ' → slot=', slotIdx, ' done=', mdlG._directoryDoneCount);
      updateFragmentDeck({ justPickedSlotIdx: slotIdx, autoExpand: true });
    } else {
      console.log('[deck] visited idx=', idx, ' label=', cfg.label, '（收藏册已满 5/5，不再追加）');
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

  /* —— 火焰溶解 3.0s（拉长，让灼烧前线推进更绵长可见） ——
   *    fromTex 由 transitionMainPanoCrossfade 自动取当前 scene.background（即镜宫）
   *    用户视觉：镜宫 → 火焰前线 → 子场景全景图
   *    相机过渡：同步把 _dirCameraTransitionT 从 0 推到 1（吊灯仰视 → 全景平视），
   *    与火焰节奏完全一致，消除"先跳到固定视角再开始烧"的瞬移感 */
  _fillDirOverlayContent(cfg);
  if(typeof transitionMainPanoCrossfade === 'function' && panoUrl){
    transitionMainPanoCrossfade(panoUrl, 'dir_' + cfg.key, 3.0, () => {
      document.body.classList.add('dir-detail-open');
      // 注意：不再 hide _dirHintEl —— n/5 收藏册需要在子场景全景图页面也持续可见
      //   （位置已挪到右上角，不会和底部 mini 卡冲突）
      if(_dirCueEl) _dirCueEl.classList.remove('show');
      // 火焰过渡完成 → 浮出 mini 卡（完整卡需要用户主动点开）
      _dirOverlayEl.classList.add('show');
      _dirSwitchingScene = false;
      _maybeTriggerFinaleFromOverlay();
    }, (_curFov !== null) ? { fromFov: _curFov, toFov: DIR_PANO_FOV } : null,
    /* onStart：贴图就绪、球壳已可见的同一帧再启动相机 tween，
     * 避免"先转视角才灼烧"的视觉跳变（贴图未缓存时尤其明显）。 */
    () => { _runDirCamTween(3000); });
  } else {
    if(!panoUrl) console.warn('[directory] DIR_PANO_MAP 未配置 key=', cfg.key);
    document.body.classList.add('dir-detail-open');
    _dirOverlayEl.classList.add('show');
    _dirSwitchingScene = false;
    _maybeTriggerFinaleFromOverlay();
  }
}

/* 检查是否已经够 5 个；若够则刷新收藏册到"闭眼"状态 */
function _maybeTriggerFinaleFromOverlay(){
  const mdlG = MODELS.golestan;
  const done = mdlG && mdlG._directoryDoneCount || 0;
  if(done >= DIRECTORY_TRIGGER_COUNT){
    if(_dirHintEl){
      _dirHintEl.classList.add('show');
      updateFragmentDeck({});
    }
  }
}

function closeDirectoryOverlay(){
  if(!_dirOverlayEl) return;

  /* —— BUG 修复 2026-06-02：关闭浮层 → 火焰过渡（3s） + 碎片提前 1.8s 渐入这段时间内，
   *   sprite/mesh 已经"虚假可见"但 _dirCurrentSceneIdx 还指向旧子场景，
   *   用户随手点屏幕会让 raycaster 命中某个未访问 sprite/mesh 的 hit-box，
   *   触发 openDirectoryOverlay(其他idx) → 跳到一个不该去的场景。
   *   对称 openDirectoryOverlay 的写法：入口立即置 true，所有出口（onComplete + 降级）置回 false。 */
  _dirSwitchingScene = true;

  const mdlG = MODELS.golestan;
  const allDone = (mdlG._directoryDoneCount || 0) >= DIRECTORY_TRIGGER_COUNT;

  _dirOverlayEl.classList.remove('show');
  _dirOverlayEl.classList.remove('expanded');

  /* —— 视角无缝冻结：把 autoRotateYaw 累积值折叠进 camYaw，并停掉自动旋转 ——
   *    数学上 targetYaw = camYaw + autoRotateYaw + PANO_YAW_OFFSET 不变，
   *    所以视觉上"完全没动一下"；之后 autoRotateYaw 清零、autoRotateActive=false，
   *    镜宫不再继续慢慢漂移，用户停在他关闭按钮那一刻看到的视角上灼烧。
   *    （进场时再重新开 autoRotate；这里只管"静止下来烧"。） */
  if(typeof autoRotateYaw !== 'undefined' && autoRotateYaw !== 0){
    if(typeof camYaw !== 'undefined'){
      camYaw = camYaw + autoRotateYaw;
    }
    autoRotateYaw = 0;
  }
  if(typeof autoRotateActive !== 'undefined') autoRotateActive = false;

  if(allDone && mdlG._collapsePaused){
    /* —— 读满 5 个：从当前子场景全景图直接火焰过渡回镜宫，
     *    完成后立刻 resume（resume 内部会启动烧灼 + 隐藏所有目录态 UI） —— */
    /* ⚠️ 注意：_dirCurrentSceneIdx 不能在这里改！
     *   它控制着"球心 yaw 朝外"vs"圆轨道朝中心"两种相机模型，
     *   提前改会让相机位置瞬切，用户感受到"突然换了视角再开始烧"。
     *   必须等火焰过渡结束、玫瑰宫贴图完全就位的同一帧再切。 */

    /* 碎片/UI 先隐藏，等过渡结束才在 onComplete 一次性显示 */
    if(_dirGroup) _dirGroup.visible = false;

    // FOV 改为与灼烧同步渐变（不再瞬切），消除回家瞬间的"放大"突变
    const _curFov1 = (typeof camera !== 'undefined' && camera) ? camera.fov : null;
    const _toFov1  = (DIR_HOME_FOV !== null) ? DIR_HOME_FOV : _curFov1;

    if(typeof transitionMainPanoCrossfade === 'function'){
      /* 启动相机模式过渡 lerp（与 crossfade 同长 3s）：
       * 主渲染循环每帧读 window._dirHomeCamLerp，把相机从"当前真实视角"渐变到"圆轨道模式"。
       *
       * 关键策略：lerp 起点 = 相机当前的 position + 当前看向的方向（用 getWorldDirection 取出来），
       * lerp 终点 = 圆轨道分支的 position + lookAt(0,0,0)。
       * 这样 k=0 那一帧无缝衔接子场景常态视角，整个过渡走最短路径，不会绕去仰视球壳顶部。 */
      const _camStartPos = (typeof camera !== 'undefined' && camera) ? camera.position.clone() : new THREE.Vector3();
      const _camDirTmp = new THREE.Vector3();
      if(typeof camera !== 'undefined' && camera) camera.getWorldDirection(_camDirTmp);
      // 起点 lookAt 点 = 起点位置 + 当前看向方向 × 100（沿视线方向 100 单位的点）
      const _camStartLook = _camStartPos.clone().add(_camDirTmp.multiplyScalar(100));
      window._dirHomeCamLerp = {
        startTime: performance.now(),
        durMs: 3000,
        startPosX: _camStartPos.x, startPosY: _camStartPos.y, startPosZ: _camStartPos.z,
        startLookX: _camStartLook.x, startLookY: _camStartLook.y, startLookZ: _camStartLook.z,
      };

      /* —— 修复 2026-05-30：消除"画面到位才闪出碎片"的断层 ——
       *  之前：crossfade 结束（3s）→ onComplete 才让碎片 visible + 渐入 600ms
       *      → 视觉上：玫瑰宫贴图已经完整呈现，再"闪一下"才看到碎片浮起来
       *  现在：crossfade 启动后 1.8s（剩 1.2s 时）就提前启动碎片显示 + 渐入
       *      碎片渐入总耗时 = 9*80ms 错位 + 600ms 单片淡入 ≈ 1.3s
       *      → crossfade 结束那一刻碎片几乎完全浮现，无断层
       *  关键：_done 标志避免 onComplete 的兜底重置 _appearStart（否则碎片会再渐入一次） */
      let _fragsShownFinale = false;
      const _showFragsForFinale = () => {
        if(_fragsShownFinale) return; // 幂等：已显示过就不再重置
        _fragsShownFinale = true;
        const t0a = performance.now();
        for(let i = 0; i < _dirBigShards.length; i++){
          const spr = _dirBigShards[i].sprite;
          if(spr){
            spr.visible = true;
            if(spr.material) spr.material.opacity = 0; // 起步透明，靠 update 循环渐入
          }
          _dirBigShards[i]._appearStart = t0a + i * 80;
        }
        if(_dirGroup) _dirGroup.visible = true;

        // 恢复吊灯爆炸碎片（只是 visible，碎片本身不需渐入）
        if(typeof shardInstMeshes !== 'undefined' && shardInstMeshes && shardInstMeshes[0] && shardInstMeshes[0].inst){
          shardInstMeshes[0].inst.visible = true;
        }
      };
      const _fragsTimerFinale = setTimeout(_showFragsForFinale, 1800);

      transitionMainPanoCrossfade(DIR_HOME_PANO_URL, 'golestan', 3.0, () => {
        /* —— 火焰过渡结束：碎片此刻已基本浮现完毕，只需收尾状态 —— */
        clearTimeout(_fragsTimerFinale); // 保险：crossfade 万一提前结束就立刻显示
        _showFragsForFinale();           // 兜底：若 timer 没触发才执行（_fragsShownFinale 守卫）
        _dirCurrentSceneIdx = -1;
        _dirSwitchingScene = false; // BUG 修复 2026-06-02：火焰过渡结束才解除点击锁
        window._dirHomeCamLerp = null; // 保险：清掉 lerp 状态，从此走原生圆轨道分支
        // smoothPitch 归零：避免下一帧圆轨道分支用残留的子场景 pitch 算 y 偏移
        if(typeof smoothPitch !== 'undefined') smoothPitch = 0;

        document.body.classList.remove('dir-detail-open');

        // 终幕序章：在镜宫完整呈现的瞬间，先插入两行字作为爆炸的"叙事钩子"，
        // 让用户从"突然炸了"转为"被引导进入炸开"。
        // 节奏：容器淡入 0.8s → 第一行 1.0s 后淡入 → 第二行 1.6s 后淡入
        //      → 第二行显示 1.4s 后整体淡出 → 淡出最后 0.1s 触发 resumeCollapseFromDirectory
        // 总时长 ~4.4s（相比原本 0.6s 多 3.8s，但获得了仪式感）
        _runFinalePreludeAndIgnite();
      }, (_curFov1 !== null && _toFov1 !== null) ? { fromFov: _curFov1, toFov: _toFov1 } : null);
    } else {
      _dirCurrentSceneIdx = -1;
      _dirSwitchingScene = false; // BUG 修复 2026-06-02：降级分支也要解锁
      resumeCollapseFromDirectory();
    }
  } else {
    /* —— 普通关闭：从当前子场景火焰过渡回镜宫，重新显示碎片地图，让用户继续选择。 */
    /* ⚠️ 同上：_dirCurrentSceneIdx = -1 必须延迟到 onComplete —— */

    /* 碎片地图先隐藏，过渡结束才一次性显示 */
    if(_dirGroup) _dirGroup.visible = false;

    /* —— 回玫瑰宫：让 ambient 平滑淡出（如果之前在 pink 场景启用了阳光尘埃）
     *    玫瑰宫主场景保持"无尘干净背景"，让碎片亮点更突出 */
    if(typeof ambient !== 'undefined' && ambient && typeof ambMat !== 'undefined' && ambMat){
      window._ambTargetOpacity = 0.0;
    }

    // FOV 改为与灼烧同步渐变（不再瞬切），消除回家瞬间的"放大"突变
    const _curFov2 = (typeof camera !== 'undefined' && camera) ? camera.fov : null;
    const _toFov2  = (DIR_HOME_FOV !== null) ? DIR_HOME_FOV : _curFov2;

    if(typeof transitionMainPanoCrossfade === 'function'){
      /* 启动相机模式过渡 lerp（同上）：3s 内从"当前真实视角"渐变到"圆轨道模式"。
       * 起点用相机当前 position + 当前看向的方向，避免 lerp 路径绕远（如绕去仰视顶部）。 */
      const _camStartPos2 = (typeof camera !== 'undefined' && camera) ? camera.position.clone() : new THREE.Vector3();
      const _camDirTmp2 = new THREE.Vector3();
      if(typeof camera !== 'undefined' && camera) camera.getWorldDirection(_camDirTmp2);
      const _camStartLook2 = _camStartPos2.clone().add(_camDirTmp2.multiplyScalar(100));
      window._dirHomeCamLerp = {
        startTime: performance.now(),
        durMs: 3000,
        startPosX: _camStartPos2.x, startPosY: _camStartPos2.y, startPosZ: _camStartPos2.z,
        startLookX: _camStartLook2.x, startLookY: _camStartLook2.y, startLookZ: _camStartLook2.z,
      };

      /* —— 修复 2026-05-30：碎片渐入提前 1.8s 启动，与 crossfade 结束对齐，无断层
       *   关键：_fragsShownBack 标志保证幂等，避免 onComplete 兜底重置 _appearStart 导致碎片再次渐入 */
      let _fragsShownBack = false;
      const _showFragsForBack = () => {
        if(_fragsShownBack) return; // 幂等：已显示过就不再重置
        _fragsShownBack = true;
        const t0 = performance.now();
        for(let i = 0; i < _dirBigShards.length; i++){
          const spr = _dirBigShards[i].sprite;
          if(spr){
            spr.visible = true;
            if(spr.material) spr.material.opacity = 0;
          }
          _dirBigShards[i]._appearStart = t0 + i * 80;
        }
        if(_dirGroup) _dirGroup.visible = true;

        // 闪光点
        if(typeof sparkleGroup !== 'undefined' && sparkleGroup){
          sparkleGroup.visible = true;
          if(typeof sparkleMat !== 'undefined' && sparkleMat.uniforms.uDenseOnly){
            sparkleMat.uniforms.uDenseOnly.value = 0;
          }
          if(typeof sparkleMat !== 'undefined' && sparkleMat.uniforms.uBaseOnly){
            sparkleMat.uniforms.uBaseOnly.value = 1;
          }
          if(typeof flareSprites !== 'undefined'){
            for(const spr of flareSprites) spr.visible = true;
          }
        }
        // 吊灯爆炸碎片
        if(typeof shardInstMeshes !== 'undefined' && shardInstMeshes && shardInstMeshes[0] && shardInstMeshes[0].inst){
          shardInstMeshes[0].inst.visible = true;
        }
      };
      const _fragsTimerBack = setTimeout(_showFragsForBack, 1800);

      transitionMainPanoCrossfade(DIR_HOME_PANO_URL, 'golestan', 3.0, () => {
        /* —— 过渡结束的同一帧：切相机模型 + 收尾（碎片此刻已基本浮现完毕） —— */
        clearTimeout(_fragsTimerBack);
        _showFragsForBack(); // 兜底：万一 timer 没触发也能保证可见
        _dirCurrentSceneIdx = -1;
        _dirSwitchingScene = false; // BUG 修复 2026-06-02：火焰过渡结束才解除点击锁
        window._dirHomeCamLerp = null;
        if(typeof smoothPitch !== 'undefined') smoothPitch = 0;

        if(_dirHintEl && !allDone) _dirHintEl.classList.add('show');
      }, (_curFov2 !== null && _toFov2 !== null) ? { fromFov: _curFov2, toFov: _toFov2 } : null);
    } else {
      _dirCurrentSceneIdx = -1;
      _dirSwitchingScene = false; // BUG 修复 2026-06-02：降级分支也要解锁
    }
  }
}

/* ---------------- 点击事件 ---------------- */
let _dirSwitchingScene = false;
let _dirCurrentSceneIdx = -1;
let _dirPointerDownPos = null;
/* 进入子场景的相机 tween：把 dragPitch / camYaw / autoRotateYaw 朝 0 收敛（toZero=true），
 * 让用户在 3s 火焰过渡内从"镜宫当前任意视角"丝滑收敛到"新场景正前方·平视"。
 * 离开子场景同样调用一次 toZero=true，回镜宫时也回到正前方。 */
var _dirCamTweenId = 0;
function _runDirCamTween(durMs){
  const tweenId = (++_dirCamTweenId);
  const startTime = performance.now();
  // 起点（镜宫当前累积值）
  const fromDragPitch = (typeof dragPitch !== 'undefined') ? dragPitch : 0;
  const fromCamYaw    = (typeof camYaw    !== 'undefined') ? camYaw    : 0;
  const fromAutoYaw   = (typeof autoRotateYaw !== 'undefined') ? autoRotateYaw : 0;
  const tick = () => {
    if(tweenId !== _dirCamTweenId) return;
    const k = Math.min(1, (performance.now() - startTime) / durMs);
    // ease-in-out cubic（与 transitionMainPanoCrossfade 内的 ease 一致）
    const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const factor = 1 - eased;  // 1 → 0
    if(typeof dragPitch !== 'undefined')     dragPitch     = fromDragPitch * factor;
    if(typeof camYaw    !== 'undefined')     camYaw        = fromCamYaw    * factor;
    if(typeof autoRotateYaw !== 'undefined') autoRotateYaw = fromAutoYaw   * factor;
    if(k < 1) requestAnimationFrame(tick);
    else {
      // 收尾：精确归零，避免浮点残差
      if(typeof dragPitch !== 'undefined')     dragPitch     = 0;
      if(typeof camYaw    !== 'undefined')     camYaw        = 0;
      if(typeof autoRotateYaw !== 'undefined') autoRotateYaw = 0;
    }
  };
  requestAnimationFrame(tick);
}

window.addEventListener('pointerdown', (e) => {
  _dirPointerDownPos = { x: e.clientX, y: e.clientY, t: performance.now() };
}, true);

window.addEventListener('pointerup', (e) => {
  const mdlG = MODELS.golestan;
  if(!mdlG || !mdlG._collapsePaused || !_dirInited) return;
  if(!_dirBigShards.length) return;
  if(_dirSwitchingScene) return;

  /* —— BUG 修复 2026-06-02：浮层内（mini 卡 / 长文案 / × / footer "↑收起" 等）的点击
   *   绝不能触发 raycaster 跳转。pointerup 是 window capture 阶段最先收到，
   *   即使 footer/按钮自己 stopPropagation 也来不及（capture 比 bubble 早）。
   *   这里直接看 e.target 的 DOM 链：只要属于 #dirOverlay 子树就 return。
   *   现象：在长文案点 "↑收起" 后立刻被 raycaster 命中下一个未访问 sprite，
   *        被错跳到下一个场景。 */
  if(e.target && typeof e.target.closest === 'function'){
    if(e.target.closest('.dir-overlay, #dirOverlay, #fragmentDeck, #finale, #finalePrelude')){
      return;
    }
  }

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

  /* sprite 是 3D 月光文字标签，永远朝向相机，hit-box 比视觉看上去更大；
   * 用户在镜厅画面"随手点全景"时，raycaster 经常会打中某个非视觉焦点的 sprite，
   * 如果允许跳已访问场景，就会陷入"关掉再点又被拉回"的死循环。
   *
   * 所以这里和 mesh 退化路径一样，只允许跳到 visited=false 的"未访问场景"：
   * - 探索新场景：点击 sprite / 碎片体（自动过滤已访问）
   * - 重访旧场景：必须主动点右上角"收藏册槽位"按钮（精确意图入口）
   */
  const sprites = _dirBigShards
    .map((s, i) => (s.sprite && s.sprite.visible && i !== _dirCurrentSceneIdx && !s.visited) ? s.sprite : null)
    .filter(Boolean);
  const sprHits = raycaster.intersectObjects(sprites, false);
  if(sprHits.length > 0){
    /* 多个标签在屏幕上重叠时，raycaster 默认按"3D 距相机最近"排序，
     * 这和"用户视觉上点中的"未必一致（透视投影下后面那个标签也可能更靠近指点位置）。
     * 改成：在所有命中里选"标签中心点投影到屏幕上后，离点击位置最近"的那个。
     * 这样无论 3D 远近，都能选到用户视觉真正点中的标签。 */
    let bestSpr = sprHits[0].object;
    if(sprHits.length > 1){
      const ndcPoint = new THREE.Vector3();
      let bestDist = Infinity;
      for(const hit of sprHits){
        ndcPoint.copy(hit.object.position).project(camera);
        const sx = (ndcPoint.x + 1) * 0.5 * window.innerWidth;
        const sy = (1 - ndcPoint.y) * 0.5 * window.innerHeight;
        const d = Math.hypot(sx - e.clientX, sy - e.clientY);
        if(d < bestDist){ bestDist = d; bestSpr = hit.object; }
      }
      console.log('[directory] 多 sprite 重叠命中，选屏幕最近，dist=', bestDist.toFixed(1), 'idx=', bestSpr.userData._dirIdx);
    }
    const idx = bestSpr.userData._dirIdx;
    if(idx !== undefined && idx !== _dirCurrentSceneIdx && !_dirBigShards[idx].visited){
      openDirectoryOverlay(idx); return;
    }
  }
  /* —— 点击空白/全景区域：raycaster 命中 mesh（碎片体）的退化路径 ——
   * 注意：sprite 与 mesh 两条路径都已加 visited 过滤，杜绝"误触跳已访问"死循环。
   * 重访已访问场景请走右侧收藏册槽位按钮。
   */
  const meshes = _dirBigShards
    .map((s, i) => (s.mesh && i !== _dirCurrentSceneIdx && !s.visited) ? s.mesh : null)
    .filter(Boolean);
  const mHits = raycaster.intersectObjects(meshes, false);
  if(mHits.length > 0){
    const hitMesh = mHits[0].object;
    const idx = _dirBigShards.findIndex(s => s.mesh === hitMesh);
    if(idx >= 0 && idx !== _dirCurrentSceneIdx && !_dirBigShards[idx].visited){
      openDirectoryOverlay(idx);
    }
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
    el.className = 'finale finale-minimal finale-credits';
    /* 滚动结构：
     *   .finale-content（视口，不滚）
     *     .finale-roll（被 translateY 缓慢上推的内容轨道）
     *       .finale-block × 3
     *       .finale-end-logo（落版：标题 logo，居中）
     *   .finale-share-cue（右上角"分享提示"，滚动到底时显示） */
    el.innerHTML = ''
      + '<div class="finale-content">'
      +   '<div class="finale-roll">'
      +     '<div class="finale-block finale-block-1">'
      +       '<p>工匠不会问，镜厅会不会永存。</p>'
      +       '<p class="quiet">他只是把光借给了镜面。</p>'
      +       '<p class="quiet">十万片镜面碎了，光便分作十万颗星，</p>'
      +       '<p class="quiet">在无边的黑暗里，仍亮着，</p>'
      +       '<p class="quiet">仍是同一束光。</p>'
      +     '</div>'
      +     '<div class="finale-block finale-block-2">'
      +       '<p>文明，是一次向重力的反抗。</p>'
      +       '<p class="quiet">是有人把瓷砖一块一块铺上拱顶，</p>'
      +       '<p class="quiet">是制琴师在午夜调试一根弦，</p>'
      +       '<p class="quiet">让明天的人，听见今天的回声。</p>'
      +       '<p>战火来了，把百年压成一秒，</p>'
      +       '<p class="quiet">把秩序还原为尘。</p>'
      +     '</div>'
      +     '<div class="finale-block finale-block-3">'
      +       '<p>但尘里还有光。</p>'
      +       '<p class="quiet">明知一切终将崩塌，仍然选择建造——</p>'
      +       '<p>这是人类，写给时间的回信。</p>'
      +       '<p class="quiet">伊朗文明的遗址可能会消失。</p>'
      +       '<p class="quiet">但，凡有人记得它如何被造出来，</p>'
      +       '<p class="quiet">它就还没有真的消失。</p>'
      +     '</div>'
      +     '<div class="finale-end-logo">'
      +       '<img class="finale-logo-img" src="./assets/logo_v2.png" alt="脆弱的文明·美伊冲突延宕百日">'
      +     '</div>'
      +     '<div class="finale-actions">'
      +       '<button class="finale-action-btn" id="finaleBtnRetry" type="button">'
      +         '<span class="finale-action-line"></span>'
      +         '<span class="finale-action-text">继续探索</span>'
      +         '<span class="finale-action-line"></span>'
      +       '</button>'
      +       '<button class="finale-action-btn" id="finaleBtnTopic" type="button">'
      +         '<span class="finale-action-line"></span>'
      +         '<span class="finale-action-text">查看专题</span>'
      +         '<span class="finale-action-line"></span>'
      +       '</button>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      /* —— 右上角"点击分享"指引：彻底弃用箭头图形（无论 SVG 还是 CSS 都不够好看），
       *  改成纯文案 + Unicode 三角符号 ▲ 直接指向右上角 ··· 按钮，最干净最直观。
       *  显示时机：等 logo 出现（.rolled-end）后才渐入。 */
      + '<div class="finale-share-cue" id="finaleShareCue" aria-hidden="true">'
      +   '<div class="finale-share-text">点击分享▲</div>'
      + '</div>';
    document.body.appendChild(el);

    /* —— 关键修复（v11.1 2026-06-03）：PC 端把 finale-end-logo + finale-actions
     * 从 .finale-roll 内部"提"到 .finale-content 直接子级（同级于 .finale-roll）。
     * 原因：PC 端 .finale-roll 用 CSS animation 翻动 (translate(0, -72vh))，
     *       而它的 transform 会成为内部所有 absolute / fixed 后代的 containing
     *       block（CSS 规范规定），子元素无论怎么 absolute 都会跟着翻走。
     *       只有把 DOM 节点提到 .finale-roll 之外，才能彻底脱离翻动。
     * 移动端不动（保持原翻动结构：logo/按钮跟着诗句一起翻到视口里）。 */
    if(window.matchMedia && window.matchMedia('(min-width: 901px)').matches){
      const _contentEl = el.querySelector('.finale-content');
      const _rollEl = el.querySelector('.finale-roll');
      const _logoEl = el.querySelector('.finale-end-logo');
      const _actionsEl = el.querySelector('.finale-actions');
      if(_contentEl && _rollEl && _logoEl && _actionsEl){
        // append 到 contentEl 末尾即可（CSS 用 absolute 定位，不依赖 DOM 顺序）
        _contentEl.appendChild(_logoEl);
        _contentEl.appendChild(_actionsEl);
      }
    }

    // —— 绑定终幕双按钮事件 ——
    /* "继续探索"：reload 页面 + 附加 ?skip=fragments → app.js 检测到时会：
     *  (1) 跳过开屏序章（splash）；
     *  (2) 直接进入镜厅 golestan 场景；
     *  (3) 模型/碎片就绪后自动触发吊灯爆裂 → 0.9s 后定格到「5 片碎片可选」状态。
     *  对应"从任何子场景按 × 关闭"返回的位置：用户看到的是已爆开的镜厅 + 碎片选择界面，
     *  而不是吊灯仍完整悬挂的"开局"。 */
    const btnRetry = el.querySelector('#finaleBtnRetry');
    if(btnRetry){
      const onRetry = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          // 在原 URL 基础上注入 skip=fragments 参数（保留其他可能的 query）
          var u = new URL(window.location.href);
          u.searchParams.set('skip', 'fragments');
          // 同时清掉 hash（避免 reload 后被旧 hash 干扰）
          u.hash = '';
          window.location.href = u.toString();
        } catch(_){
          // 兜底：旧浏览器没有 URL 构造器
          var sep = location.search ? '&' : '?';
          location.href = location.pathname + (location.search || '') + sep + 'skip=fragments';
        }
      };
      btnRetry.addEventListener('click', onRetry);
      btnRetry.addEventListener('touchend', onRetry, { passive:false });
      // 阻止 capture 阶段冒泡到 raycaster
      btnRetry.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
      btnRetry.addEventListener('pointerup', (e) => e.stopPropagation(), true);
    }
    /* "查看专题"：跳转到腾讯新闻专题页 */
    const btnTopic = el.querySelector('#finaleBtnTopic');
    if(btnTopic){
      const TOPIC_URL = 'https://view.inews.qq.com/a/UTR2026010821309600?no-redirect=1';
      const onTopic = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { window.location.href = TOPIC_URL; } catch(_){ location.href = TOPIC_URL; }
      };
      btnTopic.addEventListener('click', onTopic);
      btnTopic.addEventListener('touchend', onTopic, { passive:false });
      btnTopic.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
      btnTopic.addEventListener('pointerup', (e) => e.stopPropagation(), true);
    }
    /* —— 点击 finale 落版 logo 时，触发右上角分享提示呼吸闪烁（仅透明度，不缩放）——
     *  让用户更明确"分享在右上角"。要求：
     *  - logo 本身仍可被自然交互（不阻止默认 + 不冒泡到 stage 引发别的）
     *  - 闪烁完后回到常态呼吸；多次连点不叠加（先移除再加 class，强制重启 animation） */
    const logoImg = el.querySelector('.finale-logo-img');
    const shareCueEl = el.querySelector('#finaleShareCue');
    if(logoImg && shareCueEl){
      // 让 logo 可以接收点击（finale 容器是 pointer-events:none，按钮们各自 auto）
      logoImg.style.pointerEvents = 'auto';
      logoImg.style.cursor = 'pointer';
      const flashShareCue = (e) => {
        if(e){ e.preventDefault(); e.stopPropagation(); }
        // —— 埋点：点击 logo 触发分享提示，视为"分享意图"PV ——
        try{ if(typeof window.__report === 'function') window.__report('share_intent', { source: 'finale_logo' }); }catch(err){}
        // 重启 animation：先 remove 再强制 reflow 再 add
        shareCueEl.classList.remove('flash');
        // eslint-disable-next-line no-unused-expressions
        shareCueEl.offsetHeight;
        shareCueEl.classList.add('flash');
        // 闪烁持续约 3.6s（1.8s × 2 次），之后清掉 class 回到常态
        setTimeout(() => { shareCueEl.classList.remove('flash'); }, 3700);
      };
      logoImg.addEventListener('click', flashShareCue);
      logoImg.addEventListener('touchend', flashShareCue, { passive:false });
      logoImg.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    }
  }

  // 强制隐藏所有玫瑰宫 UI
  document.body.classList.add('finale-on');

  // 渐入
  requestAnimationFrame(() => {
    el.classList.add('show');
  });

  // —— 分段浮现文案：1.8s / 6s / 11s（之前 7/13s 太慢，提前 1~2s 让节奏紧凑）——
  const blocks = el.querySelectorAll('.finale-block');
  const schedule = [1800, 6000, 11000];
  blocks.forEach((b, i) => {
    setTimeout(() => b.classList.add('show'), schedule[i] || 0);
  });

  /* —— 11s 第三段开始浮现的同时，启动"片尾向上滚动"（之前 13s 太晚，提前 2s）—— */
  setTimeout(() => {
    const rollEl = el.querySelector('.finale-roll');
    const contentEl = el.querySelector('.finale-content');
    const actionsBox = el.querySelector('.finale-actions');
    const logoBox = el.querySelector('.finale-end-logo');
    const block3 = el.querySelector('.finale-block-3');
    const tailBox = actionsBox || logoBox;
    if(rollEl && contentEl && tailBox){
      const vh = contentEl.clientHeight;
      const tailBottom = tailBox.offsetTop + tailBox.offsetHeight;
      /* v5.1：按钮再大幅上移到 logo 紧贴下方
       * breathBottom = vh × 0.50 → tail 底距视口底 50vh，按钮中心约在屏幕 50% 高度处，
       * 与 logo 中心几乎重合（按钮在 logo 正下方紧贴）。
       * 之前 0.36 还是看起来按钮离 logo 远。 */
      const breathBottom = vh * 0.50;
      let distance = Math.max(0, tailBottom - vh + breathBottom);

      /* 兜底约束：保证第三段顶部不会被滚出视口顶。
       * 终态视口窗口 = [distance, distance + vh]，要求 block3.top ≥ distance + topBreath，
       * 即 distance ≤ block3.top - topBreath。topBreath 从 4vh 缩到 1vh，
       * 让 clamp 上限尽量宽松，使按钮真正能上移到 logo 边。 */
      if(block3){
        const block3Top = block3.offsetTop;
        const topBreath = vh * 0.01;
        const maxDistance = Math.max(0, block3Top - topBreath);
        if(distance > maxDistance) distance = maxDistance;
      }
      rollEl.style.setProperty('--roll-distance', distance + 'px');

      /* 持续时长按距离动态算：约 90 像素/秒（比之前 32s 固定要快/慢都自适应屏高），
       * 最短 14s 防过快，最长 26s 防过慢。 */
      const speedPxPerSec = 90;
      const dur = Math.max(14, Math.min(26, distance / speedPxPerSec));
      rollEl.style.setProperty('--roll-duration', dur.toFixed(2) + 's');
      el.classList.add('rolling');

      const onRollEnd = (ev) => {
        if(ev.target !== rollEl) return;
        if(ev.propertyName !== 'transform') return;
        rollEl.removeEventListener('transitionend', onRollEnd);
        el.classList.add('rolled-end');
      };
      rollEl.addEventListener('transitionend', onRollEnd);

      /* 兜底：transitionend 万一没触发，比时长多 0.5s 后也触发末态 */
      setTimeout(() => el.classList.add('rolled-end'), dur * 1000 + 500);
    }
  }, 11000);

  /* —— 进入 finale 后，再尝试请求一次陀螺仪权限（iOS）——
   *   有些用户在 splash 阶段权限被默默拒绝（或 splash 异步路径出错没请求成功），
   *   到 finale 阶段陀螺仪不工作。这里在用户首次触摸 finale 屏幕时再请求一次。 */
  if(typeof DeviceOrientationEvent !== 'undefined' &&
     typeof DeviceOrientationEvent.requestPermission === 'function' &&
     !window.__gyroPermissionGranted){
    const retryGyro = () => {
      try{
        DeviceOrientationEvent.requestPermission().then(state => {
          if(state === 'granted'){
            window.__gyroPermissionGranted = true;
            if(typeof window.__gyroAttachListeners === 'function'){
              window.__gyroAttachListeners('finale-retry');
            }
          }
        }).catch(()=>{});
      }catch(_){}
      el.removeEventListener('touchstart', retryGyro);
      el.removeEventListener('click', retryGyro);
    };
    el.addEventListener('touchstart', retryGyro, { once: true, passive: true });
    el.addEventListener('click', retryGyro, { once: true });
  }
}

/* _startFinaleStars 已移除：sparkle 由主场景烧灼后剩余的反光与暗环境自身呈现 */
