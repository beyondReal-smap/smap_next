import pandas as pd
import matplotlib.pyplot as plt
import io
import base64  # base64 변환을 위한 옵션 (필요 시 사용)


# 한글 폰트 설정
plt.rc("font", family="suite")  # suite 사용
# 음수 기호 깨짐 방지
plt.rc("axes", unicode_minus=False)
# 1. 더미 데이터 생성 (100명 고객 기준, 불일치 비율 30%로 설정하여 도드라지게 함)
# 회사 고객 DB (기존 전화번호)
customer_db = pd.DataFrame(
    {
        "customer_id": range(1, 101),  # 고객키
        "phone_old": [
            "123-456-" + str(i).zfill(4) for i in range(100)
        ],  # 기존 전화번호 (일부 변형)
    }
)

# 제대로 된 전화번호 데이터셋 (verified)
verified_db = pd.DataFrame(
    {
        "customer_id": range(1, 101),  # 고객키
        "phone_verified": ["123-456-" + str(i).zfill(4) for i in range(70)]  # 70% 일치
        + ["999-999-" + str(i).zfill(4) for i in range(30)],  # 30% 불일치
    }
)

# 2. 두 데이터셋 조인 및 비교
merged = pd.merge(customer_db, verified_db, on="customer_id")
merged["is_match"] = merged["phone_old"] == merged["phone_verified"]  # 일치 여부 확인

# 3. 일치/불일치 비율 계산
match_count = merged["is_match"].value_counts()
total_customers = len(merged)
match_count_num = match_count.get(True, 0)
mismatch_count = match_count.get(False, 0)
match_ratio = match_count_num / total_customers * 100
mismatch_ratio = mismatch_count / total_customers * 100

# 비율 출력 (콘솔 확인용)
print(f"총 고객 수: {total_customers}")
print(f"일치 전화번호 비율: {match_ratio:.2f}% (고객 수: {match_count_num})")
print(f"불일치 전화번호 비율: {mismatch_ratio:.2f}% (고객 수: {mismatch_count})")

# 4. 다양한 효율적인 그래프 생성

# ===== 옵션 1: 바 차트 (가장 직관적이고 비교하기 쉬움) =====
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
fig.suptitle(
    "전화번호 일치/불일치 분석 - 다양한 시각화", fontsize=16, fontweight="bold"
)

# 바 차트
bars = ax1.bar(
    ["일치", "불일치"],
    [match_count.get(True, 0), match_count.get(False, 0)],
    color=["#4CAF50", "#F44336"],
    alpha=0.8,
    width=0.6,
)
ax1.set_title("바 차트 (직관적 비교)", fontsize=14, fontweight="bold")
ax1.set_ylabel("고객 수", fontsize=12)
ax1.grid(axis="y", alpha=0.3)

# 값 표시
for bar in bars:
    height = bar.get_height()
    ax1.text(
        bar.get_x() + bar.get_width() / 2.0,
        height + 1,
        f"{int(height)}명\n({height/total_customers*100:.1f}%)",
        ha="center",
        va="bottom",
        fontsize=11,
        fontweight="bold",
    )

# ===== 옵션 2: 도넛 차트 (파이 차트보다 공간 효율적) =====
labels = ["일치", "불일치"]
sizes = [match_ratio, mismatch_ratio]
colors = ["#4CAF50", "#F44336"]

# 도넛 차트
wedges, texts, autotexts = ax2.pie(
    sizes,
    labels=labels,
    colors=colors,
    autopct="%1.1f%%",
    startangle=90,
    wedgeprops=dict(width=0.4, edgecolor="w"),
)
ax2.set_title("도넛 차트 (공간 효율적)", fontsize=14, fontweight="bold")

# 중심에 텍스트 추가
centre_circle = plt.Circle((0, 0), 0.3, fc="white")
ax2.add_artist(centre_circle)
ax2.text(
    0,
    0,
    f"총 {total_customers}명",
    ha="center",
    va="center",
    fontsize=12,
    fontweight="bold",
    color="#333",
)

# ===== 옵션 3: 게이지 차트 (KPI 스타일) =====
from matplotlib.patches import Wedge


# 게이지 차트 함수
def gauge_chart(ax, percentage, title, color):
    # 배경 원
    wedge_bg = Wedge(
        (0.5, 0.5), 0.4, 0, 180, width=0.1, facecolor="#f0f0f0", edgecolor="white"
    )
    ax.add_patch(wedge_bg)

    # 실제 값
    angle = percentage * 1.8  # 180도 범위로 변환
    wedge_value = Wedge(
        (0.5, 0.5), 0.4, 0, angle, width=0.1, facecolor=color, edgecolor="white"
    )
    ax.add_patch(wedge_value)

    # 텍스트
    ax.text(
        0.5,
        0.3,
        f"{percentage:.1f}%",
        ha="center",
        va="center",
        fontsize=16,
        fontweight="bold",
        color=color,
    )
    ax.text(0.5, 0.15, title, ha="center", va="center", fontsize=12)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")


# 게이지 차트들
gauge_chart(ax3, match_ratio, "일치 비율", "#4CAF50")
ax3.set_title("게이지 차트 (KPI 스타일)", fontsize=14, fontweight="bold")

gauge_chart(ax4, mismatch_ratio, "불일치 비율", "#F44336")
ax4.set_title("게이지 차트 (불일치 강조)", fontsize=14, fontweight="bold")

plt.tight_layout()
# GUI 환경이 아닌 경우를 위한 대체 표시
try:
    plt.show()
except:
    print("GUI 표시 불가 - 텍스트 기반 결과 표시:")
    print(
        f"📊 바 차트 데이터: 일치={match_count.get(True, 0)}명, 불일치={match_count.get(False, 0)}명"
    )
    print(f"📈 도넛 차트: 일치 {match_ratio:.1f}%, 불일치 {mismatch_ratio:.1f}%")
    print(f"🎯 게이지: 일치율 {match_ratio:.1f}%, 불일치율 {mismatch_ratio:.1f}%")

# ===== 옵션 4: 요약 통계 테이블 =====
print("\n" + "=" * 60)
print("📊 전화번호 일치/불일치 분석 요약")
print("=" * 60)
print(f"총 고객 수: {total_customers}명")
print(f"일치 고객: {match_count.get(True, 0)}명 ({match_ratio:.2f}%)")
print(f"불일치 고객: {match_count.get(False, 0)}명 ({mismatch_ratio:.2f}%)")

if mismatch_ratio > 20:
    print("⚠️  불일치 비율이 20%를 초과합니다. 데이터 품질 검토 필요!")
elif mismatch_ratio > 10:
    print("⚡ 불일치 비율이 10%를 초과합니다. 주의 필요!")
else:
    print("✅ 데이터 일치율이 양호합니다.")

print("=" * 60)

# ===== 옵션 5: 효율성 비교 및 추천 =====
fig, ax = plt.subplots(1, 1, figsize=(12, 6))

# 그래프 유형별 장단점 비교
chart_types = ["기존 파이 차트", "바 차트", "도넛 차트", "게이지 차트"]
efficiency_scores = [6, 9, 8, 7]  # 10점 만점으로 효율성 평가
readability_scores = [7, 9, 8, 7]
space_usage = [6, 8, 9, 7]

x = range(len(chart_types))
width = 0.25

bars1 = ax.bar(
    [i - width for i in x],
    efficiency_scores,
    width,
    label="효율성",
    color="#2196F3",
    alpha=0.8,
)
bars2 = ax.bar(x, readability_scores, width, label="가독성", color="#4CAF50", alpha=0.8)
bars3 = ax.bar(
    [i + width for i in x],
    space_usage,
    width,
    label="공간활용",
    color="#FF9800",
    alpha=0.8,
)

ax.set_title("그래프 유형별 비교 분석", fontsize=16, fontweight="bold", pad=20)
ax.set_xlabel("그래프 유형", fontsize=12)
ax.set_ylabel("점수 (10점 만점)", fontsize=12)
ax.set_xticks(x)
ax.set_xticklabels(chart_types, fontsize=11)
ax.legend(fontsize=10)
ax.grid(axis="y", alpha=0.3)

# 값 표시
for bars in [bars1, bars2, bars3]:
    for bar in bars:
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            height + 0.1,
            f"{height}",
            ha="center",
            va="bottom",
            fontsize=9,
            fontweight="bold",
        )

plt.tight_layout()
# GUI 환경이 아닌 경우를 위한 대체 표시
try:
    plt.show()
except:
    print("비교 그래프 표시 불가 - 텍스트 기반 결과:")
    print("그래프 유형별 점수 (10점 만점):")
    print("• 바 차트: 효율성 9, 가독성 9, 공간활용 8")
    print("• 도넛 차트: 효율성 8, 가독성 8, 공간활용 9")
    print("• 게이지 차트: 효율성 7, 가독성 7, 공간활용 7")
    print("• 기존 파이 차트: 효율성 6, 가독성 7, 공간활용 6")

# ===== 최종 추천 =====
print("\n" + "=" * 60)
print("🏆 최적 그래프 추천")
print("=" * 60)
print("1️⃣  가장 추천: 바 차트")
print("   ✅ 장점: 직관적 비교, 정확한 값 확인 용이, 공간 효율적")
print("   ✅ 사용 목적: 경영진 보고, 데이터 분석, 비교 분석")
print()
print("2️⃣  공간 최적화: 도넛 차트")
print("   ✅ 장점: 파이 차트보다 공간 효율적, 중심에 추가 정보 표시 가능")
print("   ✅ 사용 목적: 대시보드, 제한된 공간에서의 시각화")
print()
print("3️⃣  KPI 모니터링: 게이지 차트")
print("   ✅ 장점: 목표 달성도 직관적 표시, KPI 대시보드에 적합")
print("   ✅ 사용 목적: 실시간 모니터링, 목표 관리")
print()
print("4️⃣  기존 파이 차트")
print("   ✅ 장점: 친숙하고 직관적")
print("   ⚠️  단점: 정확한 값 비교 어려움, 공간 비효율적")
print("=" * 60)

# ===== 추가 옵션 6-9: 더 눈에 잘 들어오는 고급 차트들 =====
fig, ((ax5, ax6), (ax7, ax8)) = plt.subplots(2, 2, figsize=(16, 12))
fig.suptitle("전화번호 일치/불일치 고급 시각화", fontsize=16, fontweight="bold")


# ===== 옵션 6: 워터폴 차트 (변화 과정 시각화) =====
def waterfall_chart(ax, data, title):
    cumulative = 0
    colors = []
    bottoms = []

    for i, (label, value) in enumerate(data.items()):
        if i == 0:  # 시작점
            colors.append("#2196F3")
            bottoms.append(0)
            cumulative = value
        else:  # 변화량
            colors.append("#4CAF50" if value >= 0 else "#F44336")
            bottoms.append(cumulative - value)
            cumulative += value

    bars = ax.bar(
        range(len(data)),
        list(data.values()),
        bottom=bottoms,
        color=colors,
        alpha=0.8,
        width=0.6,
    )
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.set_xticks(range(len(data)))
    ax.set_xticklabels(list(data.keys()), fontsize=11)
    ax.grid(axis="y", alpha=0.3)

    # 값 표시
    for i, (bar, bottom) in enumerate(zip(bars, bottoms)):
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            bottom + height / 2.0,
            f"{height:.0f}",
            ha="center",
            va="center",
            fontsize=10,
            fontweight="bold",
        )


waterfall_data = {
    "전체": total_customers,
    "불일치": -mismatch_count,
    "일치": match_count_num,
}
waterfall_chart(ax5, waterfall_data, "워터폴 차트 (변화 과정)")


# ===== 옵션 7: 트리맵 (계층적 데이터 표현) =====
def treemap_chart(ax, sizes, labels, colors, title):
    # matplotlib만으로 트리맵 구현
    ax.clear()
    ax.set_title(title, fontsize=14, fontweight="bold")

    # 간단한 트리맵 구현 (두 개의 사각형)
    total = sum(sizes)
    width1 = sizes[0] / total
    width2 = sizes[1] / total

    # 첫 번째 사각형 (일치)
    rect1 = plt.Rectangle(
        (0, 0),
        width1,
        1,
        facecolor=colors[0],
        alpha=0.8,
        edgecolor="white",
        linewidth=2,
    )
    ax.add_patch(rect1)
    ax.text(
        width1 / 2,
        0.5,
        labels[0],
        ha="center",
        va="center",
        fontsize=11,
        fontweight="bold",
        color="white",
    )

    # 두 번째 사각형 (불일치)
    rect2 = plt.Rectangle(
        (width1, 0),
        width2,
        1,
        facecolor=colors[1],
        alpha=0.8,
        edgecolor="white",
        linewidth=2,
    )
    ax.add_patch(rect2)
    ax.text(
        width1 + width2 / 2,
        0.5,
        labels[1],
        ha="center",
        va="center",
        fontsize=11,
        fontweight="bold",
        color="white",
    )

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")


sizes = [match_count_num, mismatch_count]
labels = [
    f"일치\n{match_count_num}명\n({match_ratio:.1f}%)",
    f"불일치\n{mismatch_count}명\n({mismatch_ratio:.1f}%)",
]
colors = ["#4CAF50", "#F44336"]
treemap_chart(ax6, sizes, labels, colors, "트리맵 (계층적 표현)")

# ===== 옵션 8: 히트맵 (강도 표현) =====
import numpy as np

# 히트맵 데이터 생성
heatmap_data = np.array([[match_ratio, mismatch_ratio], [mismatch_ratio, match_ratio]])

im = ax7.imshow(heatmap_data, cmap="RdYlGn", aspect="auto", alpha=0.8)
ax7.set_title("히트맵 (강도 표현)", fontsize=14, fontweight="bold")
ax7.set_xticks([0, 1])
ax7.set_yticks([0, 1])
ax7.set_xticklabels(["일치", "불일치"], fontsize=11)
ax7.set_yticklabels(["비율", "역비율"], fontsize=11)

# 값 표시
for i in range(2):
    for j in range(2):
        text = ax7.text(
            j,
            i,
            f"{heatmap_data[i, j]:.1f}%",
            ha="center",
            va="center",
            color="white",
            fontsize=12,
            fontweight="bold",
        )

# 컬러바 추가
cbar = plt.colorbar(im, ax=ax7, shrink=0.8)
cbar.set_label("백분율 (%)", fontsize=10)


# ===== 옵션 9: 선버스트 차트 (방사형 계층) =====
def sunburst_chart(ax, sizes, labels, colors, title):
    ax.clear()
    ax.set_title(title, fontsize=14, fontweight="bold")

    # 선버스트 차트를 위한 wedge 생성
    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=labels,
        colors=colors,
        autopct="%1.1f%%",
        startangle=90,
        wedgeprops=dict(width=0.3, edgecolor="w"),
        textprops={"fontsize": 10, "fontweight": "bold"},
    )

    # 중심 텍스트
    centre_circle = plt.Circle((0, 0), 0.2, fc="white")
    ax.add_artist(centre_circle)
    ax.text(
        0,
        0,
        f"총\n{total_customers}명",
        ha="center",
        va="center",
        fontsize=12,
        fontweight="bold",
        color="#333",
    )

    ax.axis("equal")


sunburst_chart(
    ax8,
    [match_ratio, mismatch_ratio],
    ["일치", "불일치"],
    ["#4CAF50", "#F44336"],
    "선버스트 차트 (방사형)",
)

plt.tight_layout()

# ===== PNG 파일로 저장 =====
import os

# 저장 디렉토리 생성
output_dir = "chart_outputs"
os.makedirs(output_dir, exist_ok=True)

print(f"\n💾 모든 차트를 '{output_dir}' 폴더에 PNG 파일로 저장합니다...")

# 1. 전체 고급 차트 저장
try:
    fig.savefig(
        f"{output_dir}/전화번호_일치불일치_고급차트_전체.png",
        dpi=300,
        bbox_inches="tight",
    )
    print("✅ 전체 고급 차트 저장 완료")
except Exception as e:
    print(f"❌ 전체 차트 저장 실패: {e}")

# 2. 개별 차트 저장을 위한 새로운 서브플롯 생성
fig_individual, axes_individual = plt.subplots(2, 4, figsize=(20, 10))
fig_individual.suptitle(
    "전화번호 일치/불일치 개별 차트 모음", fontsize=16, fontweight="bold"
)

# 바 차트 (재생성)
bars = axes_individual[0, 0].bar(
    ["일치", "불일치"],
    [match_count_num, mismatch_count],
    color=["#4CAF50", "#F44336"],
    alpha=0.8,
    width=0.6,
)
axes_individual[0, 0].set_title("바 차트", fontsize=12, fontweight="bold")
axes_individual[0, 0].set_ylabel("고객 수", fontsize=10)
axes_individual[0, 0].grid(axis="y", alpha=0.3)
for bar in bars:
    height = bar.get_height()
    axes_individual[0, 0].text(
        bar.get_x() + bar.get_width() / 2.0,
        height + 1,
        f"{int(height)}명\n({height/total_customers*100:.1f}%)",
        ha="center",
        va="bottom",
        fontsize=9,
        fontweight="bold",
    )

# 도넛 차트 (재생성)
wedges, texts, autotexts = axes_individual[0, 1].pie(
    [match_ratio, mismatch_ratio],
    labels=["일치", "불일치"],
    colors=["#4CAF50", "#F44336"],
    autopct="%1.1f%%",
    startangle=90,
    wedgeprops=dict(width=0.4, edgecolor="w"),
)
axes_individual[0, 1].set_title("도넛 차트", fontsize=12, fontweight="bold")
centre_circle = plt.Circle((0, 0), 0.3, fc="white")
axes_individual[0, 1].add_artist(centre_circle)
axes_individual[0, 1].text(
    0,
    0,
    f"총\n{total_customers}명",
    ha="center",
    va="center",
    fontsize=10,
    fontweight="bold",
    color="#333",
)

# 게이지 차트들 (재생성)
gauge_chart(axes_individual[0, 2], match_ratio, "일치 비율", "#4CAF50")
axes_individual[0, 2].set_title("게이지 차트 (일치)", fontsize=12, fontweight="bold")

gauge_chart(axes_individual[0, 3], mismatch_ratio, "불일치 비율", "#F44336")
axes_individual[0, 3].set_title("게이지 차트 (불일치)", fontsize=12, fontweight="bold")

# 워터폴 차트 (재생성)
waterfall_chart(axes_individual[1, 0], waterfall_data, "워터폴 차트")

# 트리맵 차트 (재생성)
sizes = [match_count_num, mismatch_count]
labels = [
    f"일치\n{match_count_num}명\n({match_ratio:.1f}%)",
    f"불일치\n{mismatch_count}명\n({mismatch_ratio:.1f}%)",
]
colors = ["#4CAF50", "#F44336"]
treemap_chart(axes_individual[1, 1], sizes, labels, colors, "트리맵 차트")

# 히트맵 차트 (재생성)
heatmap_data = np.array([[match_ratio, mismatch_ratio], [mismatch_ratio, match_ratio]])
im = axes_individual[1, 2].imshow(heatmap_data, cmap="RdYlGn", aspect="auto", alpha=0.8)
axes_individual[1, 2].set_title("히트맵 차트", fontsize=12, fontweight="bold")
axes_individual[1, 2].set_xticks([0, 1])
axes_individual[1, 2].set_yticks([0, 1])
axes_individual[1, 2].set_xticklabels(["일치", "불일치"], fontsize=9)
axes_individual[1, 2].set_yticklabels(["비율", "역비율"], fontsize=9)
for i in range(2):
    for j in range(2):
        axes_individual[1, 2].text(
            j,
            i,
            f"{heatmap_data[i, j]:.1f}%",
            ha="center",
            va="center",
            color="white",
            fontsize=10,
            fontweight="bold",
        )

# 선버스트 차트 (재생성)
sunburst_chart(
    axes_individual[1, 3],
    [match_ratio, mismatch_ratio],
    ["일치", "불일치"],
    ["#4CAF50", "#F44336"],
    "선버스트 차트",
)

plt.tight_layout()

# 개별 차트 모음 저장
try:
    fig_individual.savefig(
        f"{output_dir}/전화번호_일치불일치_개별차트_모음.png",
        dpi=300,
        bbox_inches="tight",
    )
    print("✅ 개별 차트 모음 저장 완료")
except Exception as e:
    print(f"❌ 개별 차트 모음 저장 실패: {e}")

# 3. 각 차트를 개별 파일로 저장
chart_names = [
    "바_차트",
    "도넛_차트",
    "게이지_차트_일치",
    "게이지_차트_불일치",
    "워터폴_차트",
    "트리맵_차트",
    "히트맵_차트",
    "선버스트_차트",
]

for i, ax in enumerate(axes_individual.flat):
    try:
        # 각 차트를 개별 파일로 저장
        fig_temp, ax_temp = plt.subplots(figsize=(8, 6))

        if i == 0:  # 바 차트
            bars_temp = ax_temp.bar(
                ["일치", "불일치"],
                [match_count_num, mismatch_count],
                color=["#4CAF50", "#F44336"],
                alpha=0.8,
                width=0.6,
            )
            ax_temp.set_title(
                "바 차트 - 전화번호 일치/불일치 분석", fontsize=14, fontweight="bold"
            )
            ax_temp.set_ylabel("고객 수", fontsize=12)
            ax_temp.grid(axis="y", alpha=0.3)
            for bar in bars_temp:
                height = bar.get_height()
                ax_temp.text(
                    bar.get_x() + bar.get_width() / 2.0,
                    height + 1,
                    f"{int(height)}명\n({height/total_customers*100:.1f}%)",
                    ha="center",
                    va="bottom",
                    fontsize=11,
                    fontweight="bold",
                )

        elif i == 1:  # 도넛 차트
            wedges_temp, texts_temp, autotexts_temp = ax_temp.pie(
                [match_ratio, mismatch_ratio],
                labels=["일치", "불일치"],
                colors=["#4CAF50", "#F44336"],
                autopct="%1.1f%%",
                startangle=90,
                wedgeprops=dict(width=0.4, edgecolor="w"),
            )
            ax_temp.set_title(
                "도넛 차트 - 전화번호 일치/불일치 분석", fontsize=14, fontweight="bold"
            )
            centre_circle_temp = plt.Circle((0, 0), 0.3, fc="white")
            ax_temp.add_artist(centre_circle_temp)
            ax_temp.text(
                0,
                0,
                f"총\n{total_customers}명",
                ha="center",
                va="center",
                fontsize=12,
                fontweight="bold",
                color="#333",
            )

        elif i == 2:  # 게이지 차트 일치
            gauge_chart(ax_temp, match_ratio, "일치 비율", "#4CAF50")
            ax_temp.set_title(
                "게이지 차트 (일치) - 전화번호 분석", fontsize=14, fontweight="bold"
            )

        elif i == 3:  # 게이지 차트 불일치
            gauge_chart(ax_temp, mismatch_ratio, "불일치 비율", "#F44336")
            ax_temp.set_title(
                "게이지 차트 (불일치) - 전화번호 분석", fontsize=14, fontweight="bold"
            )

        elif i == 4:  # 워터폴 차트
            waterfall_chart(ax_temp, waterfall_data, "워터폴 차트 - 변화 과정")

        elif i == 5:  # 트리맵 차트
            treemap_chart(ax_temp, sizes, labels, colors, "트리맵 차트 - 계층적 표현")

        elif i == 6:  # 히트맵 차트
            im_temp = ax_temp.imshow(
                heatmap_data, cmap="RdYlGn", aspect="auto", alpha=0.8
            )
            ax_temp.set_title("히트맵 차트 - 강도 표현", fontsize=14, fontweight="bold")
            ax_temp.set_xticks([0, 1])
            ax_temp.set_yticks([0, 1])
            ax_temp.set_xticklabels(["일치", "불일치"], fontsize=11)
            ax_temp.set_yticklabels(["비율", "역비율"], fontsize=11)
            for x in range(2):
                for y in range(2):
                    ax_temp.text(
                        x,
                        y,
                        f"{heatmap_data[y, x]:.1f}%",
                        ha="center",
                        va="center",
                        color="white",
                        fontsize=12,
                        fontweight="bold",
                    )
            cbar_temp = plt.colorbar(im_temp, ax=ax_temp, shrink=0.8)
            cbar_temp.set_label("백분율 (%)", fontsize=10)

        elif i == 7:  # 선버스트 차트
            sunburst_chart(
                ax_temp,
                [match_ratio, mismatch_ratio],
                ["일치", "불일치"],
                ["#4CAF50", "#F44336"],
                "선버스트 차트 - 방사형 표현",
            )

        fig_temp.tight_layout()
        fig_temp.savefig(
            f"{output_dir}/전화번호_분석_{chart_names[i]}.png",
            dpi=300,
            bbox_inches="tight",
        )
        plt.close(fig_temp)
        print(f"✅ {chart_names[i]} 개별 저장 완료")

    except Exception as e:
        print(f"❌ {chart_names[i]} 저장 실패: {e}")

plt.close("all")  # 모든 플롯 닫기

print(
    f"\n📁 총 {len(chart_names) + 2}개의 PNG 파일이 '{output_dir}' 폴더에 저장되었습니다!"
)
print("📊 저장된 파일 목록:")
print("   - 전화번호_일치불일치_고급차트_전체.png")
print("   - 전화번호_일치불일치_개별차트_모음.png")
for name in chart_names:
    print(f"   - 전화번호_분석_{name}.png")

# GUI 환경이 아닌 경우를 위한 대체 표시
try:
    plt.show()
except:
    print("\n고급 차트 표시 불가 - PNG 파일로 저장되었습니다!")
    print("• 워터폴 차트: 전체 → 불일치 감소 → 일치 최종 상태")
    print("• 트리맵: 계층적 직사각형으로 데이터 크기 표현")
    print("• 히트맵: 색상 강도로 데이터 강도 시각화")
    print("• 선버스트: 방사형으로 데이터 분포 표현")

print("\n" + "=" * 60)
print("🚀 추가 고급 차트 옵션")
print("=" * 60)
print("5️⃣  워터폴 차트")
print("   ✅ 장점: 변화 과정을 단계별로 보여줌, 프로세스 이해에 탁월")
print("   ✅ 사용 목적: 변화 추이 분석, 단계별 프로세스 모니터링")
print()
print("6️⃣  트리맵 차트")
print("   ✅ 장점: 공간 효율적, 상대적 크기 비교 용이")
print("   ✅ 사용 목적: 계층적 데이터 분석, 대시보드")
print()
print("7️⃣  히트맵 차트")
print("   ✅ 장점: 색상으로 강도 표현, 패턴 인식 용이")
print("   ✅ 사용 목적: 상관관계 분석, 데이터 밀도 표현")
print()
print("8️⃣  선버스트 차트")
print("   ✅ 장점: 계층적 구조를 직관적으로 표현")
print("   ✅ 사용 목적: 조직도, 카테고리 분류 데이터")
print("=" * 60)

print("\n" + "=" * 60)
print("🏆 최종 추천 (눈에 잘 들어오는 순서)")
print("=" * 60)
print("🥇 워터폴 차트 - 변화 과정이 명확하게 보임")
print("🥈 트리맵 차트 - 공간 효율적이고 직관적")
print("🥉 바 차트 - 정확한 값 비교에 탁월")
print("4️⃣  히트맵 차트 - 패턴 분석에 유용")
print("5️⃣  게이지 차트 - KPI 모니터링에 최적")
print("=" * 60)

# ===== 추가 고급 차트들 =====
print("\n" + "=" * 60)
print("🎨 추가 고급 차트 생성 중...")
print("=" * 60)

# ===== 옵션 10: 레이더 차트 (다차원 데이터) =====
fig_radar, ax_radar = plt.subplots(figsize=(10, 10), subplot_kw=dict(projection='polar'))
fig_radar.suptitle("전화번호 데이터 품질 레이더 차트", fontsize=16, fontweight="bold")

# 레이더 차트 데이터
categories = ['일치율', '데이터완성도', '정확성', '신뢰성', '효율성', '품질점수']
values = [match_ratio, 95, 85, 90, 88, 92]  # 예시 값들
values_normalized = [v/100 for v in values]  # 0-1 범위로 정규화

# 각도 계산
angles = [n / float(len(categories)) * 2 * 3.14159 for n in range(len(categories))]
angles += angles[:1]  # 닫힌 다각형을 위해
values_normalized += values_normalized[:1]

# 레이더 차트 그리기
ax_radar.plot(angles, values_normalized, 'o-', linewidth=2, color='#FF6B6B', label='현재 상태')
ax_radar.fill(angles, values_normalized, alpha=0.25, color='#FF6B6B')
ax_radar.set_xticks(angles[:-1])
ax_radar.set_xticklabels(categories, fontsize=12)
ax_radar.set_ylim(0, 1)
ax_radar.grid(True)

# 값 표시
for angle, value, label in zip(angles[:-1], values, categories):
    ax_radar.text(angle, value/100 + 0.05, f'{value}%', ha='center', va='center', fontsize=10, fontweight='bold')

plt.tight_layout()
fig_radar.savefig(f"{output_dir}/전화번호_분석_레이더_차트.png", dpi=300, bbox_inches='tight')
plt.close(fig_radar)
print("✅ 레이더 차트 저장 완료")

# ===== 옵션 11: 산점도 매트릭스 (상관관계) =====
fig_scatter, axes_scatter = plt.subplots(2, 2, figsize=(12, 10))
fig_scatter.suptitle("전화번호 데이터 상관관계 분석", fontsize=16, fontweight="bold")

# 더미 상관관계 데이터 생성
np.random.seed(42)
n_samples = 100
x1 = np.random.normal(50, 15, n_samples)  # 일치율 관련
x2 = np.random.normal(70, 20, n_samples)  # 데이터 품질
x3 = np.random.normal(60, 18, n_samples)  # 처리 속도
x4 = np.random.normal(80, 12, n_samples)  # 사용자 만족도

# 산점도들
axes_scatter[0, 0].scatter(x1, x2, alpha=0.6, c='#FF6B6B', s=50)
axes_scatter[0, 0].set_xlabel('일치율 (%)', fontsize=10)
axes_scatter[0, 0].set_ylabel('데이터 품질 (%)', fontsize=10)
axes_scatter[0, 0].set_title('일치율 vs 데이터 품질', fontsize=12, fontweight='bold')
axes_scatter[0, 0].grid(True, alpha=0.3)

axes_scatter[0, 1].scatter(x2, x3, alpha=0.6, c='#4ECDC4', s=50)
axes_scatter[0, 1].set_xlabel('데이터 품질 (%)', fontsize=10)
axes_scatter[0, 1].set_ylabel('처리 속도 (%)', fontsize=10)
axes_scatter[0, 1].set_title('데이터 품질 vs 처리 속도', fontsize=12, fontweight='bold')
axes_scatter[0, 1].grid(True, alpha=0.3)

axes_scatter[1, 0].scatter(x3, x4, alpha=0.6, c='#45B7D1', s=50)
axes_scatter[1, 0].set_xlabel('처리 속도 (%)', fontsize=10)
axes_scatter[1, 0].set_ylabel('사용자 만족도 (%)', fontsize=10)
axes_scatter[1, 0].set_title('처리 속도 vs 사용자 만족도', fontsize=12, fontweight='bold')
axes_scatter[1, 0].grid(True, alpha=0.3)

axes_scatter[1, 1].scatter(x1, x4, alpha=0.6, c='#96CEB4', s=50)
axes_scatter[1, 1].set_xlabel('일치율 (%)', fontsize=10)
axes_scatter[1, 1].set_ylabel('사용자 만족도 (%)', fontsize=10)
axes_scatter[1, 1].set_title('일치율 vs 사용자 만족도', fontsize=12, fontweight='bold')
axes_scatter[1, 1].grid(True, alpha=0.3)

plt.tight_layout()
fig_scatter.savefig(f"{output_dir}/전화번호_분석_산점도_매트릭스.png", dpi=300, bbox_inches='tight')
plt.close(fig_scatter)
print("✅ 산점도 매트릭스 저장 완료")

# ===== 옵션 12: 3D 서피스 차트 =====
from mpl_toolkits.mplot3d import Axes3D

fig_3d = plt.figure(figsize=(12, 8))
ax_3d = fig_3d.add_subplot(111, projection='3d')
fig_3d.suptitle("전화번호 데이터 3D 서피스 분석", fontsize=16, fontweight="bold")

# 3D 데이터 생성
x = np.linspace(0, 100, 20)
y = np.linspace(0, 100, 20)
X, Y = np.meshgrid(x, y)
Z = np.sin(X/10) * np.cos(Y/10) * 50 + 50  # 예시 3D 함수

# 서피스 플롯
surf = ax_3d.plot_surface(X, Y, Z, cmap='viridis', alpha=0.8, linewidth=0, antialiased=True)
ax_3d.set_xlabel('일치율 (%)', fontsize=10)
ax_3d.set_ylabel('데이터 품질 (%)', fontsize=10)
ax_3d.set_zlabel('효율성 점수', fontsize=10)
ax_3d.set_title('3D 서피스 - 데이터 관계 분석', fontsize=12, fontweight='bold')

# 컬러바 추가
fig_3d.colorbar(surf, shrink=0.5, aspect=5)

plt.tight_layout()
fig_3d.savefig(f"{output_dir}/전화번호_분석_3D_서피스.png", dpi=300, bbox_inches='tight')
plt.close(fig_3d)
print("✅ 3D 서피스 차트 저장 완료")

# ===== 옵션 13: 스트림 차트 (시간별 변화) =====
fig_stream, ax_stream = plt.subplots(figsize=(14, 8))
fig_stream.suptitle("전화번호 데이터 시간별 변화 스트림 차트", fontsize=16, fontweight="bold")

# 시간별 데이터 생성 (30일)
days = np.arange(1, 31)
match_trend = 70 + 10 * np.sin(days/5) + np.random.normal(0, 2, 30)
mismatch_trend = 30 - 5 * np.sin(days/7) + np.random.normal(0, 1.5, 30)
quality_trend = 85 + 8 * np.cos(days/6) + np.random.normal(0, 1, 30)

# 스트림 차트 (영역 차트로 구현)
ax_stream.fill_between(days, 0, match_trend, alpha=0.7, color='#4CAF50', label='일치율')
ax_stream.fill_between(days, match_trend, match_trend + mismatch_trend, alpha=0.7, color='#F44336', label='불일치율')
ax_stream.fill_between(days, match_trend + mismatch_trend, match_trend + mismatch_trend + quality_trend, alpha=0.7, color='#2196F3', label='품질지수')

ax_stream.set_xlabel('일수', fontsize=12)
ax_stream.set_ylabel('비율 (%)', fontsize=12)
ax_stream.set_title('시간별 데이터 품질 변화', fontsize=14, fontweight='bold')
ax_stream.legend(fontsize=10)
ax_stream.grid(True, alpha=0.3)

plt.tight_layout()
fig_stream.savefig(f"{output_dir}/전화번호_분석_스트림_차트.png", dpi=300, bbox_inches='tight')
plt.close(fig_stream)
print("✅ 스트림 차트 저장 완료")

# ===== 옵션 14: 벌집 차트 (Hexbin) =====
fig_hex, ax_hex = plt.subplots(figsize=(10, 8))
fig_hex.suptitle("전화번호 데이터 밀도 벌집 차트", fontsize=16, fontweight="bold")

# 벌집 차트용 데이터 생성
np.random.seed(42)
x_hex = np.random.normal(50, 20, 1000)
y_hex = np.random.normal(60, 25, 1000)

# 벌집 차트
hb = ax_hex.hexbin(x_hex, y_hex, gridsize=20, cmap='YlOrRd', alpha=0.8)
ax_hex.set_xlabel('일치율 (%)', fontsize=12)
ax_hex.set_ylabel('데이터 품질 (%)', fontsize=12)
ax_hex.set_title('데이터 밀도 분포', fontsize=14, fontweight='bold')

# 컬러바 추가
cb = fig_hex.colorbar(hb, ax=ax_hex)
cb.set_label('데이터 포인트 수', fontsize=10)

plt.tight_layout()
fig_hex.savefig(f"{output_dir}/전화번호_분석_벌집_차트.png", dpi=300, bbox_inches='tight')
plt.close(fig_hex)
print("✅ 벌집 차트 저장 완료")

# ===== 옵션 15: 스택 영역 차트 (누적) =====
fig_stack, ax_stack = plt.subplots(figsize=(12, 8))
fig_stack.suptitle("전화번호 데이터 누적 영역 차트", fontsize=16, fontweight="bold")

# 카테고리별 데이터
categories_stack = ['고품질', '중품질', '저품질', '오류데이터']
values_stack = [match_count_num * 0.8, match_count_num * 0.15, match_count_num * 0.05, mismatch_count]
colors_stack = ['#4CAF50', '#FFC107', '#FF9800', '#F44336']

# 누적 영역 차트
ax_stack.stackplot(range(len(categories_stack)), values_stack, labels=categories_stack, colors=colors_stack, alpha=0.8)
ax_stack.set_xlabel('데이터 품질 등급', fontsize=12)
ax_stack.set_ylabel('고객 수', fontsize=12)
ax_stack.set_title('데이터 품질별 고객 분포', fontsize=14, fontweight='bold')
ax_stack.set_xticks(range(len(categories_stack)))
ax_stack.set_xticklabels(categories_stack, fontsize=11)
ax_stack.legend(loc='upper right', fontsize=10)
ax_stack.grid(True, alpha=0.3)

plt.tight_layout()
fig_stack.savefig(f"{output_dir}/전화번호_분석_누적영역_차트.png", dpi=300, bbox_inches='tight')
plt.close(fig_stack)
print("✅ 누적 영역 차트 저장 완료")

# ===== 옵션 16: 박스 플롯 (분포 분석) =====
fig_box, ax_box = plt.subplots(figsize=(10, 8))
fig_box.suptitle("전화번호 데이터 분포 박스 플롯", fontsize=16, fontweight="bold")

# 박스 플롯용 데이터 생성
data_box = [
    np.random.normal(75, 10, 100),  # 일치 데이터
    np.random.normal(25, 8, 100),   # 불일치 데이터
    np.random.normal(85, 5, 100),   # 고품질 데이터
    np.random.normal(15, 5, 100)    # 저품질 데이터
]
labels_box = ['일치 데이터', '불일치 데이터', '고품질 데이터', '저품질 데이터']

# 박스 플롯
bp = ax_box.boxplot(data_box, labels=labels_box, patch_artist=True, notch=True)
colors_box = ['#4CAF50', '#F44336', '#2196F3', '#FF9800']
for patch, color in zip(bp['boxes'], colors_box):
    patch.set_facecolor(color)
    patch.set_alpha(0.7)

ax_box.set_ylabel('데이터 품질 점수', fontsize=12)
ax_box.set_title('데이터 분포 및 이상치 분석', fontsize=14, fontweight='bold')
ax_box.grid(True, alpha=0.3)

plt.tight_layout()
fig_box.savefig(f"{output_dir}/전화번호_분석_박스플롯.png", dpi=300, bbox_inches='tight')
plt.close(fig_box)
print("✅ 박스 플롯 저장 완료")

# ===== 옵션 17: 바이올린 플롯 (분포 + 밀도) =====
try:
    import seaborn as sns
    fig_violin, ax_violin = plt.subplots(figsize=(10, 8))
    fig_violin.suptitle("전화번호 데이터 바이올린 플롯", fontsize=16, fontweight="bold")
    
    # 바이올린 플롯용 데이터 준비
    violin_data = []
    violin_labels = []
    for i, (data, label) in enumerate(zip(data_box, labels_box)):
        violin_data.extend(data)
        violin_labels.extend([label] * len(data))
    
    df_violin = pd.DataFrame({'Category': violin_labels, 'Value': violin_data})
    
    # 바이올린 플롯
    sns.violinplot(data=df_violin, x='Category', y='Value', ax=ax_violin, palette=colors_box)
    ax_violin.set_ylabel('데이터 품질 점수', fontsize=12)
    ax_violin.set_title('데이터 분포 밀도 분석', fontsize=14, fontweight='bold')
    ax_violin.grid(True, alpha=0.3)
    
    plt.xticks(rotation=45)
    plt.tight_layout()
    fig_violin.savefig(f"{output_dir}/전화번호_분석_바이올린플롯.png", dpi=300, bbox_inches='tight')
    plt.close(fig_violin)
    print("✅ 바이올린 플롯 저장 완료")
except ImportError:
    print("⚠️  seaborn이 설치되지 않아 바이올린 플롯을 건너뜁니다.")

# ===== 옵션 18: 컨투어 차트 (등고선) =====
fig_contour, ax_contour = plt.subplots(figsize=(10, 8))
fig_contour.suptitle("전화번호 데이터 컨투어 차트", fontsize=16, fontweight="bold")

# 컨투어 데이터 생성
x_contour = np.linspace(0, 100, 50)
y_contour = np.linspace(0, 100, 50)
X_contour, Y_contour = np.meshgrid(x_contour, y_contour)
Z_contour = np.sin(X_contour/20) * np.cos(Y_contour/20) * 50 + 50

# 컨투어 플롯
contour = ax_contour.contour(X_contour, Y_contour, Z_contour, levels=10, colors='black', alpha=0.6)
ax_contour.clabel(contour, inline=True, fontsize=8)
contourf = ax_contour.contourf(X_contour, Y_contour, Z_contour, levels=20, cmap='RdYlGn', alpha=0.8)

ax_contour.set_xlabel('일치율 (%)', fontsize=12)
ax_contour.set_ylabel('데이터 품질 (%)', fontsize=12)
ax_contour.set_title('데이터 품질 등고선', fontsize=14, fontweight='bold')

# 컬러바 추가
cbar = fig_contour.colorbar(contourf, ax=ax_contour)
cbar.set_label('품질 점수', fontsize=10)

plt.tight_layout()
fig_contour.savefig(f"{output_dir}/전화번호_분석_컨투어_차트.png", dpi=300, bbox_inches='tight')
plt.close(fig_contour)
print("✅ 컨투어 차트 저장 완료")

# ===== 옵션 19: 네트워크 그래프 (관계도) =====
fig_network, ax_network = plt.subplots(figsize=(12, 10))
fig_network.suptitle("전화번호 데이터 네트워크 관계도", fontsize=16, fontweight="bold")

# 네트워크 노드 정의
nodes = ['일치데이터', '불일치데이터', '고품질', '저품질', '처리중', '완료', '오류']
x_pos = [0.2, 0.8, 0.1, 0.9, 0.3, 0.7, 0.5]
y_pos = [0.7, 0.7, 0.3, 0.3, 0.5, 0.5, 0.1]
sizes = [match_count_num, mismatch_count, 50, 30, 40, 60, 20]

# 노드 그리기
scatter = ax_network.scatter(x_pos, y_pos, s=[s*3 for s in sizes], c=['#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0', '#00BCD4', '#795548'], alpha=0.7)

# 노드 라벨
for i, (x, y, node) in enumerate(zip(x_pos, y_pos, nodes)):
    ax_network.annotate(node, (x, y), xytext=(5, 5), textcoords='offset points', fontsize=10, fontweight='bold')

# 연결선 그리기
connections = [(0, 2), (1, 3), (2, 4), (3, 4), (4, 5), (4, 6), (5, 0), (6, 1)]
for start, end in connections:
    ax_network.plot([x_pos[start], x_pos[end]], [y_pos[start], y_pos[end]], 'k-', alpha=0.3, linewidth=1)

ax_network.set_xlim(0, 1)
ax_network.set_ylim(0, 1)
ax_network.set_title('데이터 처리 플로우 네트워크', fontsize=14, fontweight='bold')
ax_network.axis('off')

plt.tight_layout()
fig_network.savefig(f"{output_dir}/전화번호_분석_네트워크_그래프.png", dpi=300, bbox_inches='tight')
plt.close(fig_network)
print("✅ 네트워크 그래프 저장 완료")

# ===== 옵션 20: 스파이더 차트 (다각형) =====
fig_spider, ax_spider = plt.subplots(figsize=(10, 10), subplot_kw=dict(projection='polar'))
fig_spider.suptitle("전화번호 데이터 스파이더 차트", fontsize=16, fontweight="bold")

# 스파이더 차트 데이터
spider_categories = ['정확성', '완성도', '일관성', '신뢰성', '효율성', '품질', '성능', '만족도']
spider_values = [match_ratio, 85, 90, 88, 92, 87, 89, 91]
spider_values_normalized = [v/100 for v in spider_values]

# 각도 계산
spider_angles = [n / float(len(spider_categories)) * 2 * 3.14159 for n in range(len(spider_categories))]
spider_angles += spider_angles[:1]
spider_values_normalized += spider_values_normalized[:1]

# 스파이더 차트 그리기
ax_spider.plot(spider_angles, spider_values_normalized, 'o-', linewidth=3, color='#E91E63', markersize=8)
ax_spider.fill(spider_angles, spider_values_normalized, alpha=0.25, color='#E91E63')
ax_spider.set_xticks(spider_angles[:-1])
ax_spider.set_xticklabels(spider_categories, fontsize=11)
ax_spider.set_ylim(0, 1)
ax_spider.grid(True)

# 값 표시
for angle, value, label in zip(spider_angles[:-1], spider_values, spider_categories):
    ax_spider.text(angle, value/100 + 0.05, f'{value}%', ha='center', va='center', fontsize=9, fontweight='bold')

plt.tight_layout()
fig_spider.savefig(f"{output_dir}/전화번호_분석_스파이더_차트.png", dpi=300, bbox_inches='tight')
plt.close(fig_spider)
print("✅ 스파이더 차트 저장 완료")

print("\n" + "=" * 60)
print("🎉 추가 고급 차트 생성 완료!")
print("=" * 60)
print("새로 추가된 차트들:")
print("• 레이더 차트 - 다차원 데이터 분석")
print("• 산점도 매트릭스 - 상관관계 분석")
print("• 3D 서피스 차트 - 3차원 데이터 시각화")
print("• 스트림 차트 - 시간별 변화 추이")
print("• 벌집 차트 - 데이터 밀도 분석")
print("• 누적 영역 차트 - 카테고리별 누적")
print("• 박스 플롯 - 분포 및 이상치 분석")
print("• 바이올린 플롯 - 분포 밀도 (seaborn 필요)")
print("• 컨투어 차트 - 등고선 데이터")
print("• 네트워크 그래프 - 관계도 시각화")
print("• 스파이더 차트 - 다각형 분석")
print("=" * 60)

# 옵션: 그래프를 PNG 파일로 저장하거나 base64로 변환 (출력/공유 용이)
# plt.savefig('phone_match_advanced_charts.png', dpi=300, bbox_inches='tight')
# buf = io.BytesIO()
# plt.savefig(buf, format='png', dpi=300, bbox_inches='tight')
# buf.seek(0)
# img_base64 = base64.b64encode(buf.read()).decode('utf-8')
# print(f"그래프 base64 (시작 부분): {img_base64[:100]}...")  # base64 문자열 출력 (전체는 길어서 생략)
