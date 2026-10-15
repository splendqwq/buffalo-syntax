import { seededRandom } from './engine.js';

export const QUIPS = {
  generic: [
    '我不是来上语法课的！', '有种把 that 还给我！', '这局能用标点保命吗？', '我的母语是哞。',
    '句子很长，我的命很短。', '先别打，我在找主语。', '我的律师是个逗号。', '别推，我自己会倒。',
    '水牛的尽头是宾语。', '我对这段语法有异议！', '请不要随便省略我。', '这一拳算过去完成时吗？',
    '我们这算牛际关系吗？', '我只是路过一个从句。', '今天也是含牛量超标。', '牛可以输，语序不能乱。',
    '我连主句都没混进去。', '语法老师说别打脸。', '都怪这个词没有复数变化。', '本牛暂不接受采访。',
    '这局怎么没有暂停键？', '先确认词性，再确认伤情。', '我申请转学去标点班。', '这也能算完整句子？',
    '尊重每一只词性不明的牛。', '我寻思这是个语言实验。', '别打了，服务器还要上班。', '不是，我牛呢？'
  ],
  crowd: [
    '不是，说好单挑呢？', '你们的主语怎么这么多！', '宾语也是有牛权的！', '别排队打我，排队讲理！',
    '你们这是从句团建？', '对面全是施动者。', '这是什么开放式挨打？', '我一只牛扛整个语法树。',
    '名词短语能买保险吗？', '谁给我挂了这么多从句！', '我被修饰得快没了。', '一对多？我不同意！',
    '这局是水牛自助餐吗？', '你们倒是讲讲先来后到！', '我才是这一句的受害者。', '麻烦给围殴加个逗号！'
  ],
  sandwich: [
    '上面打我，我打下面。', '恩怨传递，不提供售后。', '不是我坏，是语序逼的。', '本牛负责压力传导。',
    '挨过的拳，原样转发。', '我在语法树里当中层。', '这叫水牛的薪火相传。', '别谢我，谢上一个从句。',
    '上一拳的痛，下一拳还。', '我也是受害者兼施动者！', '一边挨打，一边输出。', '牛在江湖，身不由己。',
    '我的词性是缓冲区。', '从句夹心牛，今日限定。'
  ],
  bullied: [
    '我是宾语，不是沙袋！', '这拳有语法依据吗？', '我的被动语态觉醒了。', '我只是站在动词后面。',
    '重开，我要当主语。', '可不可以欺负隔壁那只？', '下次我坐句子前排。', '一句话都没说就挨打了。',
    '本牛已经学会省略疼痛。', '我举报动词滥用职权！', '这不叫修饰，叫袭击！', '大家看清是谁先动的词。',
    '语言的暴力，原来是物理。', '我愿意退出这个名词短语。'
  ],
  bully: [
    '动词是我的行动指南。', '这不是霸凌，是谓语。', '我有主语优先权。', '拳头是我的句号。',
    '看好了，这叫及物动词。', '我输出，全靠语法。', '你站在那里就是宾语。', '别怪我，箭头这么画的。',
    '语法许可，拳头先行。', '我从布法罗打到宾语。', '谁说名词没有攻击性？', '这一拳，修饰你的脸。',
    '先动词为强。', '没有 that 也拦不住我。'
  ],
  idle: [
    '我先观察一下语法形势。', '这局我负责哞。', '我的战术是语义模糊。', '暂时安全，不代表有礼貌。',
    '先吃草，等你们打完。', '我申请做一个闲置名词。', '我在树上挂机。', '本牛正在加载恩怨。',
    '谁敢把从句挂我头上？', '不参与，也算一种词性。'
  ],
  implicit: ['你看不见我，但我有主语权。', '我被省略了，不是被开除了。', '隐身也要遵守语法。', '这拳来自上下文。', '请脑补我的英姿。', '词数不算我，锅也别算我。']
};

const PREFIXES = ['语法系', '布法罗', '不讲理的', '名词界', '野生的', '嘴硬的', '句尾的', '从句里', '失眠的', '退休的', '牛津路', '半路出家'];
const NAMES = ['背锅侠', '拳术博士', '句号终结者', '沙袋主任', '草场刺客', '牛仔队长', '逗号保镖', '嘴强王者', '暴躁助教', '省略大师', '修饰专家', '吃草冠军'];

export function banterFor(group, model, round = 0) {
  const identitySeed = model.seed ^ Math.imul(group.index + 1, 2654435761);
  const identity = seededRandom(identitySeed);
  const random = seededRandom(identitySeed ^ Math.imul(round, 2246822519));
  const category = group.implicit ? 'implicit' : group.incoming.length >= 2 ? 'crowd' : group.incoming.length && group.outgoing.length ? 'sandwich' : group.incoming.length ? 'bullied' : group.outgoing.length ? 'bully' : 'idle';
  const contextual = QUIPS[category];
  const pool = round % 3 === 2 ? QUIPS.generic : contextual;
  const nickname = PREFIXES[Math.floor(identity() * PREFIXES.length)] + NAMES[Math.floor(identity() * NAMES.length)];
  const quote = pool[(Math.floor(random() * pool.length) + round) % pool.length];
  return { nickname, quote, category };
}

export function bubbleLines(text, width = 11) {
  const chars = Array.from(text), lines = [];
  for (let i = 0; i < chars.length; i += width) lines.push(chars.slice(i, i + width).join(''));
  return lines;
}
