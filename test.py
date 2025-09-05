import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from math import pi

# 데이터 생성 (이전과 동일)
np.random.seed(42)
n_samples = 200
channels = ['tm', 'lms', 'app']
match_rates = {'lms': 0.75, 'tm': 0.60, 'app': 0.45}

data = []
for _ in range(n_samples):
    channel = np.random.choice(channels)
    match_status = np.random.rand() < match_rates[channel]
    data.append({'channel': channel, 'match': 1 if match_status else 0})

df = pd.DataFrame(data)

# 채널별 일치율 계산 (이전과 동일)
channel_match_rates = df.groupby('channel')['match'].mean().sort_values(ascending=False)
match_rate_df = pd.DataFrame(channel_match_rates).reset_index()
match_rate_df.columns = ['Channel', 'Match Rate']

# 레이더 차트 생성
labels = match_rate_df['Channel'].tolist()
values = match_rate_df['Match Rate'].tolist()

# 닫힌 루프를 위해 첫 번째 값을 끝에 추가
num_vars = len(labels)
angles = [n / float(num_vars) * 2 * pi for n in range(num_vars)]
angles += angles[:1]
values += values[:1]

fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))

ax.plot(angles, values, linewidth=2, linestyle='solid', label='일치율', color='skyblue')
ax.fill(angles, values, 'skyblue', alpha=0.4)

ax.set_yticklabels([]) # y축 레이블 숨기기
ax.set_xticks(angles[:-1])
ax.set_xticklabels(labels, fontsize=12)
ax.set_ylim(0, 1) # 일치율이 0% ~ 100% 범위

ax.set_title('채널별 전화번호 일치율 (레이더 차트)', fontsize=16, pad=20)
ax.legend(loc='upper right', bbox_to_anchor=(1.3, 1.1))

plt.savefig('channel_match_rates_radar.png')

plt.show()