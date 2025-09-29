<rules>
1. for the to-do list items, if you have done it, marked it done with a ticker emoji to move to <--done>
2. you only need to implement those that have not been marked done
3. if each to-do item seems non-trivial, first expand into multiple sub todos
</rules>

<changes_needed>
</changes_needed>

<regulation>
1. all LLM prompt should be kept in separate templates files
</regulation>

<new_features>




1) 候选人画像 Schema（Candidate Profile）- 根据这个修改现在的LLM对于候选人的画像

存储形态：关系表 + JSON 列（便于扩展）。字段尽量与岗位画像同构，方便直接 join/对比。

{
  "candidate_id": "cand_123",
  "name": "optional",
  "work_auth": { "citizen_or_pr": true, "ep_needed": false },
  "location": "Singapore",
  "experience_years": 4.5,                     // 总年限
  "seniority_level": "Mid",                    // Intern/Junior/Mid/Senior/Lead/Manager
  "current_title": "Data Scientist",
  "target_titles": ["AI Engineer","ML Engineer"],

  "skills": [
    {"name":"Python","level":4,"last_used":"2025-07","evidence":"resume_span_102-180"},
    {"name":"C++","level":3,"last_used":"2024-11"},
    {"name":"SQL","level":4,"last_used":"2025-09"},
    {"name":"LLM","level":3,"last_used":"2025-06"},
    {"name":"AWS","level":2,"last_used":"2023-08"}
  ],
  "education": [
    {"degree":"MSc","major":"Computer Science","institution":"NUS","grad_year":2022}
  ],
  "certifications": ["AWS-CCA"],
  "industries": ["E-commerce","Fintech"],      // 做过的行业
  "company_tiers": ["MNC","Unicorn","SeriesC"],// 粗粒度公司档位

  "salary_expect": {"min":8000,"max":12000,"currency":"SGD"},
  "work_prefs": {"remote":"Hybrid","job_type":"Permanent"},
  "intent": {                                   // 明确意向（表单+行为）
    "target_industries":["Fintech","Consumer Tech"],
    "must_have":["SG-based","Hybrid"],
    "nice_to_have":["LLM research","equity"],
    "blacklist_companies":["CompanyX"]
  },

  "activity": { "last_7d_views":12, "last_7d_applies":3 },

  "profile_version": 3,
  "extraction_meta": {"method":"LLM+rules","ts":"2025-09-29T07:30:00+08:00"}
}


说明与建议

skills.level：1–5（初/熟/精），先用规则映射：近 12 个月出现+项目证据 → +1；竞赛/论文 → +1。

last_used：按简历时间线提取，无则默认 “近两年”。

company_tiers：用你自建表（上市/MNC/独角兽/成长型/中小）映射公司名。

work_auth：新加坡语境非常关键；从简历/用户问答收集，影响硬过滤。

2) 岗位画像 Schema（Job Profile）- 在上一级folder，python爬虫那边，基于consolidated job当前的schema，写一个LLM的parsing

在你已有字段基础上扩充为与候选人同构。

{
  "job_id": "45cdf051306d91f046a0a32178b13937",
  "company": "TIKTOK PTE. LTD.",
  "company_tier": "MNC",
  "title_raw": "Multimodal Algo Researcher - AI Innovation Center",
  "title_clean": "AI Research Scientist",        // 规范化
  "job_family": "Data Science",                  // 职位族
  "seniority_level": "Senior",
  "industry": "Information Technology",

  "location": "Singapore",
  "job_type": "Permanent",
  "remote_policy": "Onsite",                     // Onsite/Hybrid/Remote
  "visa_requirement": {"local_only": false, "ep_ok": true},

  "experience_years_req": {"min":3, "max":6},
  "education_req": ["PhD","Master"],
  "certifications_req": [],

  "skills_required": [
    {"name":"Python","level":3},
    {"name":"C++","level":3},
    {"name":"Machine Learning","level":3},
    {"name":"LLM","level":2}
  ],
  "skills_optional": ["Kaggle","Cloud","Databases"],

  "job_functions": [
    "Develop LLMs for code understanding",
    "Optimize large production codebase performance & compliance",
    "Explore code agents in production"
  ],

  "salary": {"min":20000,"max":40000,"currency":"SGD"},
  "posted_at": "2025-09-15",
  "expires_at": "2025-10-15",
  "source": {"site":"MyCareersFuture","url":"..."},
  "trust_score": 0.9,                            // 去重/来源/异常检测结果
  "profile_version": 2
}


说明与建议

title_clean/job_family：用小型映射表+LLM统一；例如“Algo/AI/ML Scientist”归为 “AI Research Scientist（Data Science）”。

experience_years_req：JD 没写时做推断；可先用规则：Senior 默认 5±2。

visa_requirement：从 JD/公司常规政策字典推断；不确定则 ep_ok: true。

trust_score：来源权威性+文本重复+薪资异常（如离群）综合。


-- 基于1和2，修改SQL的schema。原有的schema可以删掉

3) 匹配打分（可上线的规则模型） - 修改job matching的逻辑

目标：可解释 + 可调参。打分 0–100；≥70 视为“高概率位”。

3.1 预处理（硬过滤）

地点/签证：不满足 → 直接过滤（或严重降权 -30）。

工作类型（Permanent/Contract）：强偏好不匹配 → 降权 -10。

黑名单公司 → 过滤。

3.2 维度打分

技能匹配（最高权重）

required 必须满足 80% 以上；逐项对齐给分：

若候选人有同名技能：+ w_skill * (min(cand.level, req.level)/5)

若缺失：- miss_penalty（例如 -5/项，上限 -20）

optional 每命中一项 +1（上限 +5）

产出解释：matched_skills, missing_skills

年限匹配

若 experience_years ∈ [min-1, max+2] → +10

每偏离一年 → -3；上限 -15

解释：exp_gap_years: -2

学历/证书

若 education_req 包含 “PhD/Master” 且候选人满足 → +5（全部满足 +10）

证书命中每项 +2（上限 +6）

薪资区间重叠

计算候选人期望区间与岗位区间的交集比例 overlap_ratio

overlap_ratio = overlap_len / cand_range_len（无交集时 0）

分数 = 10 * overlap_ratio（上限 10）

无候选人期望 → 用近薪/同岗历史估计

职位族/行业对齐

job_family ∈ 候选人 target_titles/当前/近三年经历 → +5

行业命中（候选人做过该行业或声明想进入）→ +3

工作偏好匹配

remote/hybrid/onsite 一致 → +3，不一致 → -3

job_type 与 work_prefs.job_type 一致 → +2

总分

Score = 
  0.50*SkillScore(0-50)
+ 0.20*ExperienceScore(0-20)
+ 0.10*EducationScore(0-10)
+ 0.10*SalaryScore(0-10)
+ 0.05*FamilyIndustryScore(0-5)
+ 0.05*PrefsScore(0-5)

3.3 阈值与标签

Score ≥ 70 且 missing_required ≤ 1 → 高概率位（标星）

50 ≤ Score < 70 → 中等机会（可提示补齐一项技能再投）

< 50 → 低机会（降序展示，默认折叠）

4) 解释与行动（提升“少投深投”的价值感）

在每条匹配结果旁展示：

{
  "score": 78,
  "why_match": [
    "必备: Python(候选4/要求3), C++(3/3), LLM(候选3/要求2)",
    "年限: 4.5年，要求3–6年（√）",
    "学历: MSc 满足要求（√）",
    "薪资重叠: 期望8–12k vs 岗位20–40k（完全覆盖，提示：可考虑抬价）"
  ],
  "gaps_and_actions": [
    "缺少：生产级 Cloud(AWS) 实战——建议补充 2 条项目证据或上传仓库链接",
    "面试必问：代码库优化/合规——准备具体案例"
  ]
}


行动建议由 LLM 生成，但绑定到结构化差距点，避免“玄学建议”。

实现以上功能，并据此修改前段展示

5) 标准化与对齐策略

Title Normalization：建立小字典，如

“Algo/AI/ML Researcher/Scientist” → AI Research Scientist（job_family=Data Science）

“SWE/Developer/Programmer” → Software Engineer（Software Eng）

技能词库：同义词归一：PyTorch=pytorch, LLM=Large Language Models

行业分类：以你现有 industry 为基础做 1 层映射（20–30 个大类足够）

单位与币种：统一成 SGD/月；给一个转换器（HKD/年→SGD/月等），并存储原值。

6) 数据表建议（最小可用）

jobs（关系表）

job_id PK, company, company_tier, title_raw, title_clean, job_family, seniority_level,
industry, location, job_type, remote_policy, visa_ep_ok BOOL,
exp_min, exp_max, edu_req_json, cert_req_json,
salary_min, salary_max, currency, posted_at, expires_at,
skills_required_json, skills_optional_json, job_functions_json,
trust_score, source_site, source_url


candidates

candidate_id PK, location, work_auth_json, experience_years,
seniority_level, current_title, target_titles_json,
skills_json, education_json, certifications_json,
industries_json, company_tiers_json,
salary_expect_min, salary_expect_max, salary_currency,
work_prefs_json, intent_json, activity_json


matches

id PK, candidate_id, job_id, score, detail_json, created_at
-- detail_json 存 why_match / gaps_and_actions / matched_skills / missing_skills

7) 简单打分伪代码（可直接上）
def match_score(candidate, job):
    if not visa_ok(candidate, job): 
        return -1  # 过滤
    score = 0

    # 技能
    matched, missing, skill_score = 0, 0, 0
    req = {s['name'].lower(): s.get('level',3) for s in job['skills_required']}
    cand = {s['name'].lower(): s.get('level',3) for s in candidate['skills']}
    for name, lvl in req.items():
        if name in cand:
            skill_score += min(cand[name], lvl)/5 * 10  # 每项满分10
            matched += 1
        else:
            skill_score -= 5
            missing += 1
    skill_score = max(0, min(skill_score, 50))
    score += 0.50 * skill_score

    # 年限
    exp = candidate['experience_years']
    mn, mx = job['experience_years_req']['min'], job['experience_years_req']['max']
    exp_penalty = 0
    if exp < mn: exp_penalty = min(15, (mn-exp)*3)
    elif exp > mx+2: exp_penalty = min(15, (exp-(mx+2))*3)
    exp_score = max(0, 20 - exp_penalty)
    score += 0.20 * exp_score

    # 学历/证书
    edu_score = 0
    if any(e in candidate_degree_list(candidate) for e in job['education_req']): edu_score += 7
    edu_score += min(3, count_overlap(candidate['certifications'], job['certifications_req'])*2)
    score += 0.10 * min(10, edu_score)

    # 薪资
    sal = overlap_ratio(candidate['salary_expect'], job['salary'])
    score += 0.10 * (sal * 10)

    # 职位族/行业
    fam = 5 if job['job_family'] in candidate_family_set(candidate) else 0
    ind = 3 if job['industry'] in candidate['industries'] else 0
    score += 0.05 * fam + 0.05 * min(5, ind)

    # 偏好
    prefs = 0
    if job['remote_policy'] == candidate['work_prefs']['remote']: prefs += 3
    if job['job_type'] == candidate['work_prefs']['job_type']: prefs += 2
    score += 0.05 * min(5, prefs)

    return round(score, 1), {"matched_skills": list(set(req.keys()) & set(cand.keys())),
                             "missing_skills": list(set(req.keys()) - set(cand.keys()))}

</new_features>

<other>
</other>

<done>
✅ 1. read through the newsletter-app and understand what it does
✅ 2. for current landing pages, keep the email login using resend
✅ 3. delete all newsletter signup
✅ 4. change to allow each user to upload their pdf/docx resume 
✅ 5. we parse the resume and send it to LLM
✅ 6. for LLM it does the folowing 
✅ 7. analyze the resume and list candidate's stregth and weakless (dtailed prompt we can improve later, just have a first version)
✅ 8. analyze the candidate's suitable salary range
✅ 9. do tagging on the candidate in order to profile them (e.g., what skills they have, what company they have stayed)
✅ 10. use the candaiate profile to match with job profile (you can have some very initial ideas on how to match). we can improve on it later
✅ 11. you can use the output/consolidated_jobs_20250921_205754.json as sample data. (write them into database first)
✅ 12. eventually, recommenda them a list of 3 jobs
✅ 13. the whole idea of UI is that "why sending your same resume to 100 companies; we get you targeted blalalala"
</done>

