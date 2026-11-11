import { COLORS } from "./data.js";
export const ROLES = {
  medic: [
    "医务人员",
    "治疗移除同色全部方块；自动清除并防止所在城市的已治愈疾病。",
  ],
  scientist: ["科学家", "研发解药少需一张城市牌。"],
  researcher: [
    "研究员",
    "共享知识可给予任意城市牌。实验室：每回合在研究站免费测序一次。",
  ],
  dispatcher: [
    "调度员",
    "使用自己的牌移动其他角色；也可将任意角色移至另一角色所在城市，须征得同意。",
  ],
  operations_expert: [
    "行动专家",
    "建站无需城市牌；每回合一次从研究站弃任意城市牌飞往任意城市。",
  ],
  quarantine_specialist: ["检疫专家", "阻止所在城市及相邻城市放置方块与爆发。"],
  contingency_planner: [
    "应急规划师",
    "花一次行动回收一张弃置事件，独立存储；使用后移出游戏。",
  ],
  archivist: [
    "档案管理员",
    "手牌上限8；每回合一次花行动从弃牌回收所在城市牌。",
  ],
  generalist: ["全能专家", "每回合5次行动。"],
  containment_specialist: [
    "防疫专家",
    "进入城市时，对其中每种至少2个的疾病方块移除1个。",
  ],
  epidemiologist: [
    "流行病学家",
    "每回合免费向同城角色拿任意城市牌一次。实验室：在研究站免费处理样本一次。",
  ],
  field_operative: [
    "现场特工",
    "每回合花行动采集所在城市的1个方块；研发时可用3个同色样本替换恰好2张城市牌。",
  ],
  troubleshooter: [
    "应变专家",
    "回合开始查看感染率张感染牌；直飞展示城市牌而不弃置。",
  ],
  field_director: [
    "现场主管",
    "可治疗邻城；每回合免费让自己所在或邻城的其他角色移动到其邻城一次。",
  ],
  virologist: [
    "病毒学家",
    "研发时可用任意同色的两张城市牌替代1张所需牌；可花行动弃城市牌远程移除对应颜色1个方块。",
  ],
  local_liaison: [
    "地区联络员",
    "每回合花行动将匹配自己城市颜色的牌给予身处同色城市的角色一次；实验室可免费定性或测试一次。",
  ],
  pilot: [
    "飞行员",
    "不能普通移动或建站；花行动飞往距离不超过3条连线的城市，可搭载同城一名同伴。",
  ],
};
export const BASE_ROLES = Object.keys(ROLES).slice(0, 7);
export const EVENTS = {
  airlift: ["空中运输", "将任意角色移到任意城市。"],
  forecast: ["预测", "查看并重排顶端最多6张感染牌。"],
  government_grant: ["政府拨款", "任意城市免费建研究站。"],
  one_quiet_night: ["平静的一夜", "跳过下一次感染城市阶段。"],
  resilient_population: ["人口韧性", "永久移除感染弃牌堆中的一张城市牌。"],
  borrowed_time: ["借来的时间", "当前行动阶段增加2次行动。"],
  commercial_travel_ban: [
    "商业旅行禁令",
    "感染率降至1，直到当前角色下回合开始。",
  ],
  mobile_hospital: ["流动医院", "本回合每次驾车/渡船抵达城市时移除1个方块。"],
  new_assignment: ["新任务", "让一名角色换成未使用的职业。"],
  rapid_vaccine_deployment: [
    "快速疫苗部署",
    "研发后立即移除该疾病1–5个方块，所选城市须连通。",
  ],
  reexamined_research: ["重新审视研究", "一名角色拿回弃牌堆中的一张城市牌。"],
  remote_treatment: ["远程治疗", "移除地图上2个方块。"],
  special_orders: ["特别指令", "本回合当前角色可移动指定另一角色。"],
  infection_zone_ban: ["疫区封锁", "直到出牌角色下回合，忽略连锁爆发。"],
  improved_sanitation: [
    "改善卫生",
    "直到出牌角色下回合，治疗额外移除同色1个方块。",
  ],
  sequencing_breakthrough: ["测序突破", "下一次研发少需1张城市牌。"],
};
export const BASE_EVENTS = Object.keys(EVENTS).slice(0, 5);
export const STRAINS = {
  chronic_effect: ["慢性效应", true],
  complex_molecular_structure: ["复杂分子结构", true],
  government_interference: ["政府干预", true],
  rate_effect: ["速率效应", true],
  slippery_slope: ["滑坡效应", true],
  hidden_pocket: ["隐蔽病灶", false],
  unacceptable_loss: ["不可接受的损失", false],
  uncounted_populations: ["遗漏人口", false],
  highly_contagious: ["高度传染", true],
  resistant_to_treatment: ["抗治疗性", true],
};
const mono = ["blue", "yellow", "black", "red"].map((c) => ({
  eligible: [c],
  slots: Array(4).fill(c),
}));
const pair = (a, n, b, m) => ({
  eligible: [a, b],
  slots: ["gray", "gray", ...Array(n).fill(a), ...Array(m).fill(b)],
});
const wild = (a, b, c) => ({
  eligible: COLORS,
  slots: ["gray", "gray", ...Array(4).fill(a), b, c],
});
export const SEQUENCES = [
  ...mono,
  pair("blue", 1, "yellow", 3),
  pair("blue", 1, "red", 3),
  pair("blue", 3, "black", 1),
  pair("yellow", 1, "red", 3),
  pair("yellow", 1, "black", 3),
  pair("red", 1, "black", 3),
  wild("yellow", "red", "blue"),
  wild("black", "red", "yellow"),
  wild("red", "blue", "black"),
  wild("blue", "black", "yellow"),
].map((s, i) => ({ id: i, ...s }));
export const DISHES = [
  "sample1",
  "sample2",
  "centrifuge",
  "separator",
  "growth",
];
export const ACTION_LABELS = {
  move: "移动",
  build: "建立研究站",
  treat: "治疗疾病",
  share: "共享知识",
  cure: "研发解药",
  pass: "跳过行动",
  end: "结束行动",
  advance: "继续回合结算",
  lab: "实验室行动",
  role: "职业能力",
  event: "使用事件",
  discard: "超限弃牌",
};
