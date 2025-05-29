<?php
include $_SERVER['DOCUMENT_ROOT'] . "/lib.inc.php";
$b_menu = '1';
$h_menu = '1';
include $_SERVER['DOCUMENT_ROOT'] . "/head.inc.php";
include $_SERVER['DOCUMENT_ROOT'] . "/b_menu.inc.php";

// 앱 체크(auth를 탓는지 체크)
if (!$_SESSION['_auth_chk']) {
    // 로그인 체크
    if (!isset($_SESSION['_mt_idx'])) {
        // frame 탔는지 체크
        if ($_SESSION['frame_chk'] == true && !isset($_SESSION['_mt_idx'])) {
            // frame 탔을 경우
            $_SESSION['frame_chk'] = false;
            alert($translations['txt_login_required'], './login', '');
        } else if (!isset($_SESSION['_mt_idx']) && $chk_mobile) { // mt_idx 값이 없고 모바일일 경우
            $_SESSION['frame_chk'] = false;
            alert($translations['txt_login_required'], './login', '');
        } else {
            // frame 안탔을 경우
            $_SESSION['frame_chk'] = true;
            header('Location: ./frame');
            exit;
        }
    } else { // 이미 로그인을 했을 경우
        // frame 탔을 경우
        if ($_SESSION['frame_chk'] == true) {
            $_SESSION['frame_chk'] = false;
        } else {
            // frame 안탔을 경우
            $_SESSION['frame_chk'] = true;
            header('Location: ./frame');
            exit;
        }
    }
}

if ($_SESSION['_mt_idx'] == '') {
    alert($translations['txt_login_required'], './login', '');
} else {
    // 앱토큰값이 DB와 같은지 확인
    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $mem_row = $DB->getone('member_t');
    if ($_SESSION['_mt_token_id'] != $mem_row['mt_token_id']) {
        alert($translations['txt_login_attempt_other_device'], './logout');
    }
}

$s_date = date("Y-m-d");
$sgt_cnt = f_get_owner_cnt($_SESSION['_mt_idx']); //오너인 그룹수
$sgdt_leader_cnt = f_get_leader_cnt($_SESSION['_mt_idx']); //리더인 그룹수
$sgdt_cnt = f_group_invite_cnt($_SESSION['_mt_idx']); //초대된 그룹수
$sgt_row = f_group_info($_SESSION['_mt_idx']); // 그룹생성여부

// 참여한그룹여부
$DB->where('mt_idx', $_SESSION['_mt_idx']);
$DB->where('sgt_idx', $sgt_row['sgt_idx']);
$DB->where('sgdt_show', 'Y');
$DB->where('sgdt_owner_chk', 'Y');
$sgdt_row = $DB->getone('smap_group_detail_t');

if (!$sgdt_row['sgdt_idx']) {
    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $DB->where('sgdt_show', 'Y');
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $DB->where('sgdt_owner_chk', 'N');
    $sgdt_row = $DB->getone('smap_group_detail_t');
}
$member_info_row = get_member_t_info($_SESSION['_mt_idx']);
?>
<style>
    #map {
        width: 100%;
        height: 400px;
        /* 또는 원하는 높이 */
    }

    html {
        height: 100%;
        overflow-y: unset !important;
    }

    #wrap {
        height: 100vh;
        min-height: 100vh;
        overflow-y: hidden;
    }

    .head_01 {
        background-color: #FBFBFF;
    }

    .idx_pg {
        position: fixed;
        top: 0;
        left: 50%;
        width: 100%;
        height: 100%;
        max-width: 50rem;
        transform: translateX(-50%);
        padding: 10.6rem 0 6rem 0;
        height: 100% !important;
        min-height: 100% !important;
    }

    /* 로딩 화면 스타일 */
    #map-loading {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(255, 255, 255, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .dots-spinner {
        display: flex;
        gap: 10px;
    }

    .dot {
        width: 8px;
        height: 8px;
        background-color: #0046FE;
        border-radius: 50%;
        animation: dot-bounce 1s infinite ease-in-out;
    }

    .dot:nth-child(2) {
        animation-delay: 0.2s;
    }

    .dot:nth-child(3) {
        animation-delay: 0.4s;
    }

    @keyframes dot-bounce {

        0%,
        100% {
            transform: scale(1);
        }

        50% {
            transform: scale(1.5);
        }
    }
</style>
<div class="container-fluid idx_pg px-0 ">
    <div class="idx_pg_div">
        <section class="main_top">
            <!--D-6 멤버 스케줄 미참석 팝업 임시로 넣어놓았습니다.-->
            <div class="py-3 px_16 top_weather" id="top_weather_box" style="height: 58px;">
                <div class="d-flex align-items-center p_address">
                    <p class="fs_12 text_light_gray fw_500 text_dynamic"><?= $translations['txt_loading_address_info'] ?></p>
                </div>
                <!-- 로딩할때 사용 -->
                <div class="d-flex align-items-center justify-content-between flex-wrap">
                    <div class="date_weather d-flex align-items-center flex-wrap">
                        <div class="d-flex align-items-center fs_14 fw_600 text_dynamic mr-1 mt_08"><?= DateType(date("Y-m-d"), 3) ?>
                            <span class="loader loader_sm ml-2 mr-2"></span>
                        </div>
                        <div class="d-flex align-items-center mt_08 mr-3">
                            <p class="ml-1 fs_11 fw_600 text-text fw_500 mr-2"><span class="fs_11 text_light_gray mr-1"><?= $translations['txt_getting_weather_data'] ?></span></p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
        <!-- 지도 wrap -->
        <section class="pg_map_wrap num_point_map" id="">
            <div class="pg_map_inner" id="map_info_box">
                <div id="map-loading" style="display: flex;">
                    <div class="dots-spinner">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                </div>
                <div class="banner">
                    <div class="banner_inner">
                        <!-- Swiper -->
                        <div class="swiper banSwiper">
                            <div class="swiper-wrapper">
                                <?
                                $DB->where('bt_type', 1);
                                $DB->where('bt_show', 'Y');
                                $DB->orderby('bt_rank', 'asc');
                                $banner_list = $DB->get('banner_t');
                                if ($banner_list) {
                                    foreach ($banner_list as $bt_row) {
                                ?>
                                        <div class="swiper-slide">
                                            <div class="bner_txt">
                                                <p class="text-primary fs_13 mr-2"><i class="xi-info"></i></p>
                                                <p class="text_dynamic fs_12 fw_500 line_h1_3"><?= $bt_row['bt_title'] ?></p>
                                            </div>
                                            <div class="">
                                                <div class="rect_bner">
                                                    <img src="<?= $ct_img_url . '/' . $bt_row['bt_file'] ?>" alt="배너이미지" onerror="this.src='<?= $ct_no_img_url ?>'" />
                                                </div>
                                            </div>
                                        </div>
                                <?
                                    }
                                }
                                ?>
                            </div>
                            <div class="swiper-pagination"></div>
                        </div>
                    </div>
                </div>
                <div class="log_map_wrap" id="map" style="height:100%">
                </div>
                <div class="point_wrap point_myplt" style="top:2rem">
                    <button type="button" class="btn point point_mypoint" onclick="f_my_location_btn(<?= $_SESSION['_mt_idx'] ?>)">

                        <span class="point_inner">
                            <span class="point_txt"><img src="./img/ico_mypoint.png" width="18px" alt="<? $translations['txt_my_locations'] ?>" /></span>
                        </span>
                    </button>
                </div>
                <div class="point_wrap point_myplt" style="top:6rem">
                    <button type="button" class="btn point point_mypoint" onclick="toggleInfobox()" id="infoboxBtn">
                        <span class="point_inner">
                            <span class="point_txt"><img src="./img/ico_info_on.png" width="35px" alt="info" id="infoboxImg" /></span>
                        </span>
                    </button>
                </div>
            </div>
        </section>
        <!-- D-4 그룹 생성 직후 홈화면(오너)에 필요한 부분입니다. [시작] -->
        <?
        if ($sgt_cnt > 0 || $sgdt_leader_cnt > 0) {
            $translateY = 82;
        } else {
            $translateY = 69;
        }
        ?>
        <? if ($sgt_cnt > 0 || $sgdt_leader_cnt > 0) { // 오너, 리더일 경우
            $session_img = get_profile_image_url($member_info_row['mt_file1']);
        ?>
            <section class="opt_bottom" style="transform: translateY(<?= $translateY ?>%);">
                <div class="top_bar_wrap text-center pt_08">
                    <img src="./img/top_bar.png" class="top_bar" width="34px" alt="탑바" />
                    <img src="./img/btn_tl_arrow.png" class="top_down mx-auto" width="12px" alt="탑업" />
                </div>
                <input type="hidden" name="group_sgdt_idx" id="group_sgdt_idx" value="<?= $sgdt_row['sgdt_idx'] ?>" />
                <div class="">
                    <!-- 그룹원 자리 -->
                    <div class="grp_wrap"></div>
                    <!-- 일정리스트 -->
                    <div class="task_wrap">
                        <div class="border bg-white rounded-lg mb-3">
                            <div id="schedule_list_box">
                                <div class="task_header px_16 pt_16" id="my_location_div">
                                    <div class="border-bottom  pb-3">
                                        <div class="task_header_tit">
                                            <p class="fs_16 fw_600 line_h1_2 mr-3"><?= $translations['txt_current_location'] ?></p>
                                            <div class="d-flex align-items-center justify-content-end">
                                                <p class="move_txt fs_13 mr-3"></p>
                                                <p class="d-flex bettery_txt fs_13">
                                                    <span class="d-flex align-items-center flex-shrink-0 mr-2">
                                                        <img src="./img/battery.png?v=20240404" width="14px" class="battery_img" alt="베터리시용량">
                                                    </span>
                                                    <span class="battery_percentage"></span>
                                                </p>
                                            </div>
                                        </div>
                                        <p class="fs_14 fw_500 text_light_gray text_dynamic line_h1_3 mt-2"><?= $translations['txt_getting_current_location'] ?></p>
                                    </div>
                                </div>
                                <div class="task_body px_16 pt-3">
                                    <div class="task_body_cont num_point_map">
                                        <div class="pt-5">
                                            <!-- <button type="button" class="btn w-100 rounded add_sch_btn" onclick="location.href='./schedule_form?sdate=<?= $_POST['event_start_date'] ?>&sgdt_idx=<?= $_POST['sgdt_idx'] ?>'"><i class="xi-plus-min mr-3"></i> 일정을 추가해보세요!</button> -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <!-- D-4 그룹 생성 직후 홈화면(오너)에 필요한 부분입니다. [끝] -->
        <? } else {  // 그룹원일 경우
        ?>

            <section class="opt_bottom" style="transform: translateY(<?= $translateY ?>%);">

                <div class="top_bar_wrap text-center pt_08">
                    <img src="./img/top_bar.png" class="top_bar" width="34px" alt="탑바" />
                    <img src="./img/btn_tl_arrow.png" class="top_down mx-auto" width="12px" alt="탑업" />
                </div>
                <div class="">
                    <!-- 일정리스트 -->
                    <div class="task_wrap">
                        <div class="border bg-white rounded-lg mb-3">
                            <!-- <form method="post" name="frm_list" id="frm_list" onsubmit="return false;">
                                <input type="hidden" name="act" id="act" value="member_schedule_list" />
                                <input type="hidden" name="obj_list" id="obj_list" value="schedule_list_box" />
                                <input type="hidden" name="obj_frm" id="obj_frm" value="frm_list" />
                                <input type="hidden" name="obj_uri" id="obj_uri" value="./schedule_update" />
                                <input type="hidden" name="obj_pg" id="obj_pg" value="1" />
                                <input type="hidden" name="obj_orderby" id="obj_orderby" value="" />
                                <input type="hidden" name="obj_order_desc_asc" id="obj_order_desc_asc" value="1" />
                                <input type="hidden" name="event_start_date" id="event_start_date" value="<?= $s_date ?>" />
                                <input type="hidden" name="event_start_date_t" id="event_start_date_t" value="<?= DateType($s_date, 19) ?>" />
                                <input type="hidden" name="main_schedule" id="main_schedule" value="Y" />
                                <input type="hidden" name="sgdt_idx" id="sgdt_idx" value="<?= $sgdt_row['sgdt_idx'] ?>" />
                            </form> -->
                            <div id="schedule_list_box">
                                <div class="task_header px_16 pt_16" id="my_location_div">
                                    <div class="border-bottom  pb-3">
                                        <div class="task_header_tit">
                                            <p class="fs_16 fw_600 line_h1_2 mr-3"><?= $translations['txt_current_location'] ?></p>
                                            <div class="d-flex align-items-center justify-content-end">
                                                <p class="move_txt fs_13 mr-3"></p>
                                                <p class="d-flex bettery_txt fs_13">
                                                    <span class="d-flex align-items-center flex-shrink-0 mr-2">
                                                        <img src="./img/battery.png?v=20240404" width="14px" class="battery_img" alt="베터리시용량">
                                                    </span>
                                                    <span class="battery_percentage" style="color: #FFC107"></span>
                                                </p>
                                            </div>
                                        </div>
                                        <p class="fs_14 fw_500 text_light_gray text_dynamic line_h1_3 mt-2"><?= $translations['txt_getting_current_location'] ?></p>
                                    </div>
                                </div>
                                <div class="task_body px_16 pt-3">
                                    <div class="task_body_cont num_point_map">
                                        <div class="pt-5">
                                            <!-- <button type="button" class="btn w-100 rounded add_sch_btn" onclick="location.href='./schedule_form?sdate=<?= $_POST['event_start_date'] ?>&sgdt_idx=<?= $_POST['sgdt_idx'] ?>'"><i class="xi-plus-min mr-3"></i> 일정을 추가해보세요!</button> -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        <? } ?>
    </div>
</div>
<!-- 초대링크로 가입하셨나요? 플러팅 -->
<? if ($sgt_cnt < 1 && $sgdt_cnt < 1) { ?>
    <div class="floating_wrap on" id="first_floating_modal">
        <div class="flt_inner">
            <div class="flt_head">
                <div></div>
            </div>
            <div class="flt_body d-flex flex-column">
                <!-- Top row with text on the left and image on the right -->
                <div class="d-flex align-items-start justify-content-between mb-3">
                    <div>
                        <p class="fc_3d72ff fs_14 fw_700 text-primary mb-3"><?= $translations['txt_welcome_exclamation'] ?></p>
                        <p class="text_dynamic line_h1_3 fs_17 fw_700 mt-3"><?= $translations['txt_with_smap_life'] ?></p>
                        <!-- <span class="text-primary"></span>로 가입하셨나요?</p> -->
                    </div>
                    <img src="./img/send_img.png" class="flt_img_send" width="66px" alt="초대링크" />
                </div>
                <!-- Bottom row with additional text -->
                <div class="mb-4">
                    <p class="text_dynamic line_h1_3 text_gray fs_14 mt-1 fw_500"></p>
                </div>
            </div>
            <style>
                .flt_footer .btn {
                    height: 55px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                    padding: 10px;
                }

                .flt_footer .btn small {
                    font-size: 10px;
                    /* 작은 글씨 크기 조정 */
                    margin-top: 5px;
                    /* 큰 글씨와 작은 글씨 사이 간격 조정 */
                }
            </style>
            <div class="flt_footer flt_footer_b">
                <div class="d-flex align-items-center w-100 mx-0 my-0">
                    <button type="button" class="btn btn-primary btn-md w-50 rounded_t_left_0 rounded_t_right_0 rounded_b_right_0 flt_close" onclick="location.href='./group_create'">
                        <?= $translations['txt_become_group_owner'] ?><br>
                        <!-- <small>그룹을 만들고 그룹원을 초대할 수 있어요</small> -->
                        <small><?= $translations['txt_parent_admin'] ?></small>
                    </button>
                    <button type="button" class="btn btn-bg_gray btn-md w-50 rounded_t_left_0 rounded_t_right_0 rounded_b_left_0" onclick="location.href='./invitation_code'">
                        <?= $translations['txt_enter_invitation_code'] ?><br>
                        <!-- <small>초대코드를 입력하고 그룹에 참여하세요</small> -->
                        <small><?= $translations['txt_child_member'] ?></small>
                    </button>
                </div>
            </div>
        </div>
    </div>

<? } ?>
<!-- 그룹만들기 플러팅 -->
<div class="floating_wrap " id="group_make_modal">
    <div class="flt_inner">
        <div class="flt_head">
            <p class="line_h1_2"><span class="text_dynamic flt_badge"><?= $translations['txt_create_group'] ?></span></p>
        </div>
        <div class="flt_body pb-5 pt-3">
            <p class="text_dynamic line_h1_3 fs_17 fw_700"><?= $translations['txt_create_group_with_friends'] ?>
            </p>
            <p class="text_dynamic line_h1_3 text_gray fs_14 mt-2 fw_500"><?= $translations['txt_check_members_location'] ?></p>
        </div>
        <div class="flt_footer">
            <button type="button" class="btn btn-md btn-block btn-primary mx-0 my-0" onclick="location.href='./group_create'"><?= $translations['txt_next'] ?></button>
        </div>
    </div>
</div>
<!-- D-11 그룹 있을 때 초대링크로 앱 접속  -->
<div class="modal fade" id="dbgroup_modal" tabindex="-1">
    <div class="modal-dialog modal-default modal-dialog-scrollable modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-body text-center pb-5">
                <img src="./img/warring.png" width="72px" class="pt-3" alt="<? $translations['txt_already_in_group'] ?>" />
                <p class="fs_16 text_dynamic fw_700 line_h1_3 mt-4"><?= $translations['txt_already_in_group'] ?></p>
                <p class="fs_14 text_dynamic text_gray mt-2 line_h1_2 px-4"><?= $translations['txt_already_in_group'] ?></p>
            </div>
            <div class="modal-footer px-0 py-0">
                <button type="button" class="btn btn-md btn-block btn-primary mx-0 my-0" data-dismiss="modal" aria-label="Close"><?= $translations['txt_agreed'] ?></button>
            </div>
        </div>
    </div>
</div>
<!-- D-6 최적경로 사용 : 최적경로 표시하기 버튼 클릭시 나오는 모달창  -->
<div class="modal fade" id="optimal_modal" tabindex="-1">
    <div class="modal-dialog modal-default modal-dialog-scrollable modal-dialog-centered">
        <div class="modal-content">
            <input type="hidden" name="pedestrian_path_modal_sgdt_idx" id="pedestrian_path_modal_sgdt_idx" value="" />
            <input type="hidden" name="path_day_count" id="path_day_count" value="" />
            <div class="modal-body text-center pb-4">
                <img src="./img/optimal_map.png" width="48px" class="pt-3" />
                <?= $translations['txt_show_optimal_route'] ?>
                <p class="fs_12 text_dynamic text_gray mt-2 line_h1_2"><?= $translations['txt_optimal_route_info'] ?></p>
                <div class="optimal_info_wrap">
                    <p class="optim_plan" id="pathType"><span><?= $translations['txt_basic'] ?></span></p>
                    <p class="text-primary fs_14 fw_600 text_dynamic mt-3 line_h1_4" id="pathCountday"><?= $translations['txt_2_times_available_today'] ?></p>
                    <p class=" text-primary fs_14 fw_600 text_dynamic line_h1_4" id="pathCountmonth"><?= $translations['txt_60_times_available_month'] ?></p>
                    <p class="text_gray fs_11 text_dynamic line_h1_3 mt-2" id="pathContent"><?= $translations['txt_basic_usage_limit'] ?></p>
                </div>
            </div>
            <div class="modal-footer w-100 px-0 py-0 mt-0 border-0">
                <div class="d-flex align-items-center w-100 mx-0 my-0">
                    <button type="button" class="btn btn-bg_gray btn-md w-50 rounded_t_left_0 rounded_t_right_0 rounded_b_right_0" data-dismiss="modal" aria-label="Close"><?= $translations['txt_cancel'] ?></button>
                    <button type="button" class="btn btn-primary btn-md w-50 rounded_t_left_0 rounded_t_right_0 rounded_b_left_0" id="showPathButton"><?= $translations['txt_show'] ?></button>
                    <button type="button" class="btn btn-primary btn-md w-50 rounded_t_left_0 rounded_t_right_0 rounded_b_left_0 d-none" id="showPathAdButton"><?= $translations['txt_show'] ?></button>
                </div>
            </div>
        </div>
    </div>
</div>
<!-- D-12 유료플랜 종료  -->
<div class="modal fade" id="planinfo_modal" tabindex="-1">
    <div class="modal-dialog modal-default modal-dialog-scrollable modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-body text-center pb-5">
                <img src="./img/warring.png" width="72px" class="pt-3" alt="<?= $translations['txt_plan'] ?>" />
                <p class="fs_16 text_dynamic fw_700 line_h1_3 mt-4 mb-3"><?= $translations['txt_subscription_expired'] ?></p>
                <div class="planinfo_box">
                    <div class="mb-4">
                        <div class="d-flex align-items-center justify-content-center flex-wrap">
                            <p class="fs_16 text_dynamic fw_700 mb-4 mr-2"><?= $translations['txt_optimal_route_uses'] ?></p>
                            <p class="fs_11 text_dynamic fw_700 mb-4"><?= $translations['txt_day_month'] ?></p>
                        </div>
                        <div class="d-flex align-items-center justify-content-center">
                            <p class="text_light_gray fs_14 fw_700 mr-2">10/300</p>
                            <i class="text_light_gray fs_14 xi-arrow-right mr-2"></i>
                            <p class="text-primary fs_14 fw_700">2/60</p>
                        </div>
                    </div>
                    <div class="mb-4">
                        <p class="fs_16 text_dynamic fw_700 line_h1_3 mb-4"><?= $translations['txt_save_my_location'] ?></p>
                        <div class="d-flex align-items-center justify-content-center">
                            <p class="text_light_gray fs_14 fw_700 mr-2"><?= $translations['txt_unlimited'] ?></p>
                            <i class="text_light_gray fs_14 xi-arrow-right mr-2"></i>
                            <p class="text-primary fs_14 fw_700"><?= $translations['txt_2_locations'] ?></p>
                        </div>
                    </div>
                    <div class="mb-4">
                        <p class="fs_16 text_dynamic fw_700 line_h1_3 mb-4"><?= $translations['txt_log_period'] ?></p>
                        <div class="d-flex align-items-center justify-content-center">
                            <p class="text_light_gray fs_14 fw_700 mr-2"><?= $translations['txt_2_weeks'] ?></p>
                            <i class="text_light_gray fs_14 xi-arrow-right mr-2"></i>
                            <p class="text-primary fs_14 fw_700"><?= $translations['txt_2_days'] ?></p>
                        </div>
                    </div>
                    <div class="mb-4">
                        <div class="rect_modalbner">
                            <?= $translations['txt_ads_will_be_shown'] ?>
                        </div>
                    </div>
                    <p class="fs_14 text_gray text_dynamic line_h1_3"><?= $translations['txt_extend_subscription'] ?></p>
                </div>
            </div>
            <div class="modal-footer w-100 px-0 py-0 mt-0 border-0">
                <div class="d-flex align-items-center w-100 mx-0 my-0">
                    <button type="button" class="btn btn-bg_gray btn-md w-50 rounded_t_left_0 rounded_t_right_0 rounded_b_right_0" onclick="location.href='./plan_info'"><?= $translations['txt_subscribe'] ?></button>
                    <button type="button" class="btn btn-primary btn-md w-50 rounded_t_left_0 rounded_t_right_0 rounded_b_left_0" data-dismiss="modal" aria-label="Close"><?= $translations['txt_confirmed'] ?></button>
                </div>
            </div>
        </div>
    </div>
</div>
<script src="https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey=6BGAw3YxGA6tVPu0Olbio7fwXiGjDV7g4VRlF3Pq"></script>
<script src="https://apis.openapi.sk.com/tmap/vectorjs?version=1&appKey=6BGAw3YxGA6tVPu0Olbio7fwXiGjDV7g4VRlF3Pq"></script>
<script>
    var scheduleMarkers = []; // 스케줄 마커를 저장할 배열입니다.
    var optimalPath; // 최적 경로를 표시할 변수입니다.
    var drawInfoArr = [];
    var resultdrawArr = [];
    var scheduleMarkerCoordinates = [];
    var scheduleStatus = [];
    var startX, startY, endX, endY; // 출발지와 도착지 좌표 변수 초기화
    var markers = [];
    var polylines = [];
    var profileMarkers = [];
    var pathCount;
    // 버튼 엘리먼트 찾기
    var showPathButton = document.getElementById('showPathButton');
    var showPathAdButton = document.getElementById('showPathAdButton'); //광고실행버튼
    // let map = null; // 이미 전역에 선언되어 있으므로 제거
    var centerLat, centerLng;
    // 전역 상태 객체
    const state = {
        pathData: null,
        walkingData: null,
        isDataLoaded: false
    };
    // 그룹원별 슬라이드 컨테이너를 저장할 객체
    const groupMemberSlides = {};
    let googleMapsLoaded = false;
    let googleMapsLoadPromise = null;
    let optBottomSelect;
    let bottomSheetHeight;
    let mapContainer = document.getElementById("map");
    let mapHeight = mapContainer.getBoundingClientRect().height;
    let verticalCenterOffset;
    let optBottom = document.querySelector(".opt_bottom");
    let isPannedDown = false;
    let originalCenter = null; // 초기 중심 좌표 저장
    let currentLat;
    let currentLng;
    const loadingElement = document.getElementById('map-loading');
    let previousTransformY = optBottom.style.transform; // 이전 transformY 값 저장
</script>
<?php
// 한국어 사용자를 위한 네이버 지도 API 스크립트
if ($userLang == 'ko' && $mem_row['mt_map'] == 'N') {
?>
    <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<?= NCPCLIENTID ?>&submodules=geocoder&callback=CALLBACK_FUNCTION"></script>
    <!-- SK TMAP -->
    <script>
        map = new naver.maps.Map("map", {
            center: new naver.maps.LatLng(<?= $_SESSION['_mt_lat'] ?>, <?= $_SESSION['_mt_long'] ?>),
            zoom: 16,
            mapTypeControl: false
        }); // 전역 변수로 map을 선언하여 다른 함수에서도 사용 가능하도록 합니다.

        function initNaverMap(markerData, sgdt_idx) {
            // 지도 객체가 존재하면 초기화
            if (map) {
                // 기존 마커 제거
                profileMarkers.forEach(marker => marker.setMap(null));
                scheduleMarkers.forEach(marker => marker.setMap(null));
                markers.forEach(marker => marker.setMap(null));

                // 기존 폴리라인 제거
                polylines.forEach(polyline => polyline.setMap(null));

                // 배열 초기화
                profileMarkers = [];
                scheduleMarkers = [];
                markers = [];
                polylines = [];
            } else {
                // 지도 객체가 없다면 새�� 생성
                map = new naver.maps.Map("map", {
                    center: new naver.maps.LatLng(37.5666805, 126.9784147), // 기본 중심 좌표 (필요에 따라 수정)
                    zoom: 16,
                    mapTypeControl: false
                });
            }
            let profileCount = 0;
            let scheduleCount = 0;

            map.setZoom(16); // 줌 레벨 16으로 초기화

            scheduleMarkerCoordinates = [];

            for (const sgdtIdx in markerData) {
                const memberData = markerData[sgdtIdx];

                // 프로필 마커 생성
                const profileLat = parseFloat(memberData.member_info.mt_lat);
                const profileLng = parseFloat(memberData.member_info.mt_long);
                const profileImageUrl = memberData.member_info.my_profile;

                if (!isNaN(profileLat) && !isNaN(profileLng)) {
                    profileCount++;

                    // DOM 노드 생성
                    const pointWrapDiv = document.createElement('div');
                    pointWrapDiv.className = 'point_wrap';

                    const mapUserDiv = document.createElement('div');
                    mapUserDiv.className = 'map_user';
                    pointWrapDiv.appendChild(mapUserDiv);

                    const mapRtImgDiv = document.createElement('div');
                    mapRtImgDiv.className = 'map_rt_img rounded_14';
                    mapUserDiv.appendChild(mapRtImgDiv);

                    const rectSquareDiv = document.createElement('div');
                    rectSquareDiv.className = 'rect_square';
                    mapRtImgDiv.appendChild(rectSquareDiv);

                    const image = document.createElement('img');
                    image.src = profileImageUrl;
                    image.alt = '<?= $translations['txt_image'] ?>';
                    image.onerror = function() {
                        this.src = '<?= $ct_no_img_url ?>';
                    };
                    rectSquareDiv.appendChild(image);

                    const profileMarkerOptions = {
                        position: new naver.maps.LatLng(profileLat, profileLng),
                        map: map,
                        icon: {
                            content: pointWrapDiv,
                            size: new naver.maps.Size(44, 44),
                            origin: new naver.maps.Point(0, 0),
                            anchor: new naver.maps.Point(22, 22),
                        },
                        zIndex: memberData.member_info.sgdt_idx && sgdtIdx === memberData.member_info.sgdt_idx.toString() ? 999 : 2,
                    };
                    const profileMarker = new naver.maps.Marker(profileMarkerOptions);
                    profileMarkers.push(profileMarker);
                }

                // 현재 멤버의 sgdt_idx와 입력받은 sgdt_idx가 일치하는 경우에만 스케줄 마커 생성
                if (sgdtIdx === sgdt_idx.toString()) {
                    currentLat = parseFloat(memberData.member_info.mt_lat);
                    currentLng = parseFloat(memberData.member_info.mt_long);
                    // 스케줄 마커 생성
                    memberData.schedules.forEach((schedule, index) => {
                        const scheduleLat = parseFloat(schedule.sst_location_lat);
                        const scheduleLng = parseFloat(schedule.sst_location_long);
                        const status = schedule.sst_all_day === 'Y' ?
                            'point_ing' :
                            new Date() >= new Date(schedule.sst_edate) ?
                            'point_done' :
                            new Date() >= new Date(schedule.sst_sdate) && new Date() <= new Date(schedule.sst_edate) ?
                            'point_ing' :
                            'point_gonna';
                        const options = {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                        };
                        const sst_sdate_e1 = new Date(schedule.sst_sdate).toLocaleTimeString('<?= $userLang ?>', options);
                        const sst_sdate_e2 = new Date(schedule.sst_edate).toLocaleTimeString('<?= $userLang ?>', options);
                        const colorSets = [
                            ['#E6F2FF', '#E0F0FF'],
                            ['#D6E6FF', '#E0E6FF'],
                            ['#E5F1FF', '#E0F0FF'],
                            ['#F0F8FF', '#E6F0FF'],
                            ['#E0FFFF', '#E6FFFF'],
                            ['#E6F2FF', '#E0EDFF'],
                            ['#D6E6FF', '#E0E0FF'],
                            ['#E5F1FF', '#E0EDFF'],
                            ['#F0F8FF', '#E6EDFF'],
                            ['#E0FFFF', '#E6FEFF'],
                        ];
                        const randomSet = colorSets[Math.floor(Math.random() * colorSets.length)];
                        const color1 = randomSet[0];
                        const color2 = randomSet[1];
                        const pointClass =
                            status === 'point_ing' ?
                            'point2' :
                            status === 'point_done' ?
                            'point1' :
                            'point3';

                        if (!isNaN(scheduleLat) && !isNaN(scheduleLng)) {
                            scheduleCount++;
                            const markerContent = `
                                                <style>
                                                    .infobox5 {
                                                    position: absolute;
                                                    left: 50%;
                                                    top: 100%;
                                                    transform: translate(10%, -50%);
                                                    background-color: #413F4A;
                                                    padding: 0.3rem 0.8rem;
                                                    border-radius: 0.4rem;
                                                    z-index: 1;
                                                    display: inline-block;
                                                    white-space: nowrap;
                                                    overflow: hidden;
                                                    text-overflow: ellipsis;
                                                    margin-top: 0.4rem;
                                                    display: none;  /* 기본적으로 숨김 */ 
                                                    }
                                                    .infobox5 span {
                                                    white-space: nowrap !important;
                                                    overflow: hidden !important;
                                                    text-overflow: ellipsis !important;
                                                    }
                                                    .infobox5 .title {
                                                    color: ${color1};
                                                    display: block;
                                                    width: 100%;
                                                    margin-bottom: 0.1rem;
                                                    font-size: 12px !important;
                                                    font-weight: 800 !important;
                                                    }
                                                    .infobox5 .date-wrapper {
                                                    display: flex;
                                                    flex-direction: column;
                                                    align-items: flex-start;
                                                    }
                                                    .infobox5 .date {
                                                    color: ${color2};
                                                    margin-bottom: 0;
                                                    font-size: 8px !important;
                                                    font-weight: 700 !important;
                                                    }
                                                    .infobox5 .date + .date {
                                                    margin-top: 0.05rem;
                                                    }
                                                    .infobox5.on {
                                                    display: inline-block;  /* .on 클래스가 추가되면 표시 */
                                                    }
                                                </style>
                                                <div class="point_wrap ${pointClass}">
                                                    <button type="button" class="btn point ${status}">
                                                    <span class="point_inner">
                                                        <span class="point_txt">${scheduleCount}</span>
                                                    </span>
                                                    </button>
                                                    <div class="infobox5 rounded_04 px_08 py_03 on">
                                                    <span class="title">${schedule.sst_title}</span>
                                                    <div class="date-wrapper">
                                                        <span class="date">S: ${sst_sdate_e1}</span>
                                                        <span class="date">E: ${sst_sdate_e2}</span>
                                                    </div>
                                                    </div>
                                                </div>
                                                `;
                            const markerOptions = {
                                position: new naver.maps.LatLng(scheduleLat, scheduleLng),
                                map: map,
                                icon: {
                                    content: markerContent,
                                    size: new naver.maps.Size(61, 61),
                                    origin: new naver.maps.Point(0, 0),
                                    anchor: new naver.maps.Point(30, 30),
                                },
                                zIndex: 1,
                            };
                            const marker = new naver.maps.Marker(markerOptions);
                            scheduleMarkers.push(marker);
                            markers.push(marker);

                            if (scheduleCount === 1) {
                                startX = scheduleLat;
                                startY = scheduleLng;
                            } else if (scheduleCount === memberData.schedules.length) {
                                endX = scheduleLat;
                                endY = scheduleLng;
                            }

                            scheduleMarkerCoordinates.push(new naver.maps.LatLng(scheduleLat, scheduleLng));
                            scheduleStatus.push(status);
                        }
                    });
                }
            }

            // marker_reload 값 설정 (필요에 따라 수정)
            markerData.marker_reload = profileCount > 0 || scheduleCount > 0 ? 'Y' : 'N';
            markerData.profile_count = profileCount;
            markerData.count = scheduleCount;

            // 지도 중심 설정 및 이동 제한 (필요에 따라 수정)
            // if (profileCount > 0) {
            //     const firstProfileMarker = profileMarkers[0];
            //     map.setCenter(firstProfileMarker.getPosition());
            // } else if (scheduleCount > 0) {
            //     const firstScheduleMarker = scheduleMarkers[0];
            //     map.setCenter(firstScheduleMarker.getPosition());
            // }

            // 지도 이동 시 이벤트 리스너 추가
            naver.maps.Event.addListener(map, 'idle', function() {
                var bounds = map.getBounds();
                markers.forEach(function(marker) {
                    if (bounds.hasLatLng(marker.getPosition())) {
                        marker.setMap(map);
                    } else {
                        marker.setMap(null);
                    }
                });
                polylines.forEach(function(polyline_) {
                    // 폴리라인의 경계를 가져옵니다.
                    var polylineBounds = polyline_.getBounds();
                    if (polylineBounds && bounds.intersects(polylineBounds)) {
                        polyline_.setMap(map);
                    } else {
                        polyline_.setMap(null);
                    }
                });
            });

            // initNaverMap 함수 끝에 map 변수의 상태를 체크하고 map이 정상적으로 생성되었을 때에만 setCursor 호출
            // if (map) {
            //     map.setCursor('pointer');
            //     // map.panBy(new naver.maps.Point(0, verticalCenterOffset)); // 중심을 위로 이동
            // }
        }
    </script>
<?php
    // 한국어 이외의 사용자를 위한 구글 지도 API 스크립트
} else {
?>
    <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<?= NCPCLIENTID ?>&submodules=geocoder&callback=CALLBACK_FUNCTION"></script>
    <script>
        // Google Maps API 로드 함수를 네이버 맵스 API 로드 함수로 변경
        // let map = null; // 이미 전역에 선언되어 있으므로 제거
        function loadNaverMapsScript() {
            return Promise.resolve(); // 이미 로드되었으므로 바로 resolve
        }

        // 지도 초기화 함수
        async function initMap(st_lat, st_lng) {
            console.log("네이버 지도 초기화 중...");
            
            const mapOptions = {
                center: new naver.maps.LatLng(
                    parseFloat(st_lat || 37.5666805),
                    parseFloat(st_lng || 126.9784147)
                ),
                zoom: 15,
                mapTypeControl: false
            };

            map = new naver.maps.Map(document.getElementById('map'), mapOptions);
            
            console.log("지도가 성공적으로 초기화되었습니다");
            return map;
        }

        // 페이지 로드 시 네이버 맵스 초기화
        window.addEventListener('load', () => {
            loadNaverMapsScript().then(() => {
                initMap().catch(error => console.error("지도 초기화 오류:", error));
            }).catch(error => console.error("네이버 맵스 API 로드 오류:", error));
        });

        window.addEventListener('resize', function() {
            if (map) {
                naver.maps.Event.trigger(map, 'resize');
            }
        });

        // 구글 지도 API를 사용하는 지도 초기화 및 관련 함수들
        async function initGoogleMap(markerData, sgdt_idx) {
            try {
                await loadNaverMapsScript();

                // 기존 map 객체가 있다면 재사용하고, 없으면 새로 생성
                if (!map) {
                    console.log("initGoogleMap 호출");
                    map = await initMap(markerData[sgdt_idx].member_info.mt_lat, markerData[sgdt_idx].member_info.mt_long);
                } else {
                    // 기존 map 객체가 있다면 중심 좌표만 업데이트
                    map.setCenter(new naver.maps.LatLng(
                        parseFloat(markerData[sgdt_idx].member_info.mt_lat),
                        parseFloat(markerData[sgdt_idx].member_info.mt_long)
                    ));
                }

                console.log("네이버 지도가 사용자 정의 데이터로 초기화되었습니다");
            } catch (error) {
                console.error("initGoogleMap 오류:", error);
                showErrorToUser("네이버 지도를 초기화하는 데 실패했습니다. 다시 시도해 주세요.");
            }

            map.setZoom(15); // 줌 레벨 설정

            if (markerData) {
                // 기존 마커와 폴리라인 제거
                clearAllMapElements();

                // 마커와 폴리라인 배열 초기화
                markers = [];
                polylines = [];
                profileMarkers = [];
                scheduleMarkers = [];

                let scheduleCount = 0; // 전체 스케줄 개수 초기화
                let profileCount = 0; // 프로필 마커 개수 초기화

                for (const currentSgdtIdx in markerData) { // markerData 객체 순회
                    const memberData = markerData[currentSgdtIdx];
                    const profileLat = parseFloat(memberData.member_info.mt_lat);
                    const profileLng = parseFloat(memberData.member_info.mt_long);
                    const profileImageUrl = memberData.member_info.my_profile;

                    if (!isNaN(profileLat) && !isNaN(profileLng)) {
                        profileCount++;
                        addNaverProfileMarker(profileLat, profileLng, profileImageUrl);
                    }
                }

                scheduleMarkerCoordinates = [];
                for (const currentSgdtIdx in markerData) {
                    // 현재 멤버의 sgdt_idx와 입력받은 sgdt_idx가 일치하는 경우에만 스케줄 마커 생성
                    if (currentSgdtIdx === sgdt_idx.toString()) {
                        currentLat = parseFloat(markerData[currentSgdtIdx].location_info.mlt_lat);
                        currentLng = parseFloat(markerData[currentSgdtIdx].location_info.mlt_long);
                        const memberData = markerData[currentSgdtIdx];

                        // 스케줄이 있는 멤버인지 확인
                        if (memberData.schedules.length > 0) {
                            markerData.schedule_chk = 'Y'; // schedule_chk 값 설정
                            memberData.schedules.forEach((schedule, index) => {
                                const scheduleLat = parseFloat(schedule.sst_location_lat);
                                const scheduleLng = parseFloat(schedule.sst_location_long);
                                const status = schedule.sst_all_day === 'Y' ?
                                    'point_ing' :
                                    new Date() >= new Date(schedule.sst_edate) ?
                                    'point_done' :
                                    new Date() >= new Date(schedule.sst_sdate) && new Date() <= new Date(schedule.sst_edate) ?
                                    'point_ing' :
                                    'point_gonna';
                                const options = {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                };
                                const sst_sdate_e1 = new Date(schedule.sst_sdate).toLocaleTimeString('<?= $userLang ?>', options);
                                const sst_sdate_e2 = new Date(schedule.sst_edate).toLocaleTimeString('<?= $userLang ?>', options);

                                if (!isNaN(scheduleLat) && !isNaN(scheduleLng)) {
                                    scheduleCount++;
                                    scheduleMarkerCoordinates.push(new naver.maps.LatLng(scheduleLat, scheduleLng));
                                    try {
                                        createNaverScheduleMarker(scheduleLat, scheduleLng, scheduleCount, schedule.sst_title,
                                            sst_sdate_e1, sst_sdate_e2, status
                                        )
                                    } catch (error) {
                                        console.error("스케줄 마커 생성 오류:", error);
                                    }

                                    if (scheduleCount === 1) {
                                        startX = scheduleLat;
                                        startY = scheduleLng;
                                    } else if (scheduleCount === memberData.schedules.length) {
                                        endX = scheduleLat;
                                        endY = scheduleLng;
                                    }
                                }
                            });
                        }
                    }
                }
                markerData.count = scheduleCount; // markerData에 전체 스케줄 개수 저장
            }
        }

        function createNaverScheduleMarker(lat, lng, index, title, startTime, endTime, status) {
            // 스타일 CSS 추가
            const style = document.createElement('style');
            style.textContent = `
            .infobox5 {
                position: absolute;
                left: 50%;
                top: 100%;
                transform: translate(10%, -50%);
                background-color: #413F4A;
                padding: 0.3rem 0.8rem;
                border-radius: 0.4rem;
                z-index: 1;
                display: inline-block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 0.4rem;
                display: none;  /* 기본적으로 숨김 */ 
            }
            .infobox5 span {
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            }
            .infobox5 .title {
                color: #E0FFFF;
                display: block;
                width: 100%;
                margin-bottom: 0.1rem;
                font-size: 12px !important;
                font-weight: 800 !important;
            }
            .infobox5 .date-wrapper {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
            }
            .infobox5 .date {
                color: #E6FFFF;
                margin-bottom: 0;
                font-size: 8px !important;
                font-weight: 700 !important;
            }
            .infobox5 .date + .date {
                margin-top: 0.05rem;
            }
            .infobox5.on {
                display: inline-block;  /* .on 클래스가 추가되면 표시 */
            }
        `;
            document.head.appendChild(style);

            // 마커 HTML 콘텐츠 생성
            const markerContent = `
                <div class="point_wrap point${index}">
                    <button type="button" class="btn point ${status}">
                        <span class="point_inner">
                            <span class="point_txt">${index}</span>
                        </span>
                    </button>
                    <div class="infobox5 rounded_04 px_08 py_03 on">
                        <span class="title">${title}</span>
                        <div class="date-wrapper">
                            <span class="date">S: ${startTime}</span>
                            <span class="date">E: ${endTime}</span>
                        </div>
                    </div>
                </div>
            `;

            // 네이버 마커 생성
            const scheduleMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(parseFloat(lat), parseFloat(lng)),
                map: map,
                icon: {
                    content: markerContent,
                    size: new naver.maps.Size(61, 61),
                    origin: new naver.maps.Point(0, 0),
                    anchor: new naver.maps.Point(30, 30),
                },
                zIndex: 1,
            });

            scheduleMarkers.push(scheduleMarker);
            markers.push(scheduleMarker);
        }

        function addNaverProfileMarker(lat, lng, imageUrl) {
            // 프로필 마커 HTML 컨텐츠 생성
            const content = `
                <div class="point_wrap">
                    <div class="map_user">
                        <div class="map_rt_img rounded_14">
                            <div class="rect_square">
                                <img src="${imageUrl}" alt="<?= $translations['txt_image'] ?>" onerror="this.src='https://app2.smap.site/img/no_image.png';" />
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 네이버 마커 생성
            const profileMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(parseFloat(lat), parseFloat(lng)),
                map: map,
                icon: {
                    content: content,
                    size: new naver.maps.Size(44, 44),
                    origin: new naver.maps.Point(0, 0),
                    anchor: new naver.maps.Point(22, 22),
                },
                zIndex: 2,
            });
            
            profileMarkers.push(profileMarker);
        }

        async function showGoogleOptimalPath(startX, startY, endX, endY, scheduleMarkerCoordinates, scheduleStatus) {
            // showOptimalPath 함수 구현을 네이버 맵스 버전으로 변경
            let viaPoints = [];
            // 중심점 이동
            function moveMap() {
                const lat = parseFloat(startX);
                const lng = parseFloat(startY);

                if (optBottom && optBottom.style.transform === 'translateY(0px)') {
                    // opt_bottom이 열려 있을 때
                    map.setCenter(new naver.maps.LatLng(lat, lng));
                    map.panBy(new naver.maps.Point(0, 180));
                } else {
                    // opt_bottom이 닫혀 있을 때
                    map.setCenter(new naver.maps.LatLng(lat, lng));
                }
            }

            // 지도 이동 실행
            moveMap();

            // 경로 배열 생성
            const waypoints = [];
            waypoints.push(new naver.maps.LatLng(parseFloat(startX), parseFloat(startY)));

            for (let coord of scheduleMarkerCoordinates) {
                let lat, lng;
                if (coord.lat) {
                    lat = coord.lat;
                    lng = coord.lng;
                } else {
                    lat = coord._lat;
                    lng = coord._lng;
                }
                waypoints.push(new naver.maps.LatLng(lat, lng));
            }

            // 폴리라인 그리기
            clearMapElements(polylines);
            polylines = [];

            // 색상 그라데이션 생성
            const gradient = createGradient(waypoints.length);

            // 경로 그리기
            for (let i = 0; i < waypoints.length - 1; i++) {
                const polyline = new naver.maps.Polyline({
                    path: [waypoints[i], waypoints[i + 1]],
                    strokeColor: gradient[i],
                    strokeWeight: 5,
                    strokeOpacity: 0.5,
                    map: map
                });
                polylines.push(polyline);
            }

            // 경로 데이터 저장
            let pathData = waypoints.map((coord, index) => ({
                lat: coord.y || coord._lat || coord.lat,
                lng: coord.x || coord._lng || coord.lng,
                color: index < gradient.length ? gradient[index] : "#000000",
            }));

            // 경로 정보 계산 (임의로 구간별 시간과 거리 계산)
            let walkingData = [];
            for (let i = 0; i < waypoints.length - 1; i++) {
                const distance = calculateDistance(waypoints[i], waypoints[i + 1]);
                const duration = Math.round(distance * 12); // 1km당 약 12분 소요 가정
                
                walkingData.push({
                    distance: distance.toFixed(2),
                    duration: duration.toString(),
                    start_address: "위치 " + (i + 1),
                    end_address: "위치 " + (i + 2),
                });
            }

            // DB에 경로 정보 저장
            var sgdt_idx = $('#pedestrian_path_modal_sgdt_idx').val();
            var form_data = new FormData();
            form_data.append('act', 'loadpath_add');
            form_data.append('sgdt_idx', sgdt_idx);
            form_data.append('sllt_json_text', JSON.stringify(pathData));
            form_data.append('sllt_json_walk', JSON.stringify(walkingData));
            form_data.append('event_start_date', '<?= $s_date ?>');
            form_data.append("sllt_language", '<?= $userLang ?>');

            $.ajax({
                url: './schedule_update',
                enctype: 'multipart/form-data',
                data: form_data,
                type: 'POST',
                async: true,
                contentType: false,
                processData: false,
                cache: true,
                timeout: 5000,
                success: function(data) {
                    if (data === 'Y') {
                        // GA 이벤트 전송
                        gtag('event', 'show_optimal_path', {
                            'event_category': 'optimal_path',
                            'event_label': 'show',
                            'user_id': '<?= $_SESSION["_mt_idx"] ?>',
                            'platform': isAndroidDevice() ?
                                'Android' : isiOSDevice() ?
                                'iOS' : 'Unknown',
                        });
                    } else {
                        jalert($translations['txt_invalid_access']);
                    }
                },
                error: function(err) {
                    console.log(err);
                },
            });
        }

        // 두 지점 사이의 거리를 계산하는 함수
        function calculateDistance(point1, point2) {
            const lat1 = point1.lat() || point1._lat || point1.y;
            const lng1 = point1.lng() || point1._lng || point1.x;
            const lat2 = point2.lat() || point2._lat || point2.y;
            const lng2 = point2.lng() || point2._lng || point2.x;
            
            const R = 6371; // 지구 반경 (km)
            const dLat = deg2rad(lat2 - lat1);
            const dLng = deg2rad(lng2 - lng1);
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
                Math.sin(dLng/2) * Math.sin(dLng/2); 
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
            const distance = R * c; // 거리 (km)
            
            return distance;
        }

        // 색상 그라데이션 생성 함수
        function createGradientGoogle(pathLength) {
            const colors = [
                '#FF0000', // 빨간색
                '#FFA500', // 주황색
                '#FFFF00', // 노란색
                '#00FF00', // 초록색
                '#0000FF', // 파란색
                '#000080', // 남색
                '#800080', // 보라색
            ];
            const gradient = [];
            const steps = pathLength.length - 1;
            const colorSteps = colors.length - 1; // 색상 단계 수

            for (let i = 0; i <= steps; i++) {
                const colorIndex = Math.floor(i / steps * colorSteps); // 현재 색상 인덱스
                const nextColorIndex = Math.min(colorIndex + 1, colorSteps); // 다음 색상 인덱스
                const ratio = (i / steps * colorSteps) - colorIndex; // 현재 색상 구간 내 비율

                const color = interpolateColor(colors[colorIndex], colors[nextColorIndex], ratio);
                gradient.push(color);
            }

            return gradient;
        }
    </script>
<?php } ?>
<script>
    $(document).ready(function() {
        sessionStorage.clear();
        // renderMemberList를 먼저 실행하고 나머지 작업 수행
        renderMemberList(<?= $sgdt_row['sgdt_idx'] ?>).then(() => {
            Promise.all([
                calcScreenOffset(),
                f_get_box_list2(),
                checkAdCount(),
                fetchWeatherData()
            ]).then(() => {
                console.log('모든 비동기 작업이 완료되었습니다.');
            }).catch(error => {
                console.error('비동기 작업 중 오류가 발생했습니다:', error);
            });
        });
    });

    // function createGroupMember(sgdt_idx) {
    //     var form_data = new FormData();
    //     form_data.append("act", "group_member_list");
    //     form_data.append("group_sgdt_idx", sgdt_idx);

    //     $.ajax({
    //         url: "./location_update",
    //         enctype: "multipart/form-data",
    //         data: form_data,
    //         type: "POST",
    //         async: true,
    //         contentType: false,
    //         processData: false,
    //         cache: true,
    //         timeout: 10000,
    //         dataType: 'json',
    //         success: function(response) {
    //             if (response.result === 'success') {
    //                 renderMemberList(response.data);
    //             } else {
    //                 alert(response.message);
    //             }
    //         },
    //         error: function(err) {
    //             console.log(err);
    //         },
    //     });
    // }

    async function renderMemberList(sgdt_idx) {
        const data = await loadMemberSchedule(sgdt_idx);
        const grpWrap = $('.grp_wrap');
        grpWrap.empty(); // 기존 내용 삭제

        // 첫 번째 비본인 그룹원의 sgdt_idx 찾기
        let firstMemberSgdtIdx = null;
        for (const key in data.members) {
            if (key != <?= $sgdt_row['sgdt_idx'] ?>) {
                firstMemberSgdtIdx = key;
                break;
            }
        }

        // HTML 구조 생성 시 첫 번째 그룹원이 선택되도록 수정
        const html = `
            <div class="border bg-white rounded-lg px_16 py_16">
                <p class="fs_16 fw_600 mb-3"><?= $translations['txt_group_members'] ?></p>
                <style>
                    // ... existing styles ...
                </style>

                <div id="group_member_list_box">
                    <div class="mem_wrap mem_swiper">
                        <div class="swiper-wrapper d-flex">
                            ${generateMemberItems(data, firstMemberSgdtIdx)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        grpWrap.html(html);

        // Swiper 초기화
        mem_swiper = new Swiper(".mem_swiper", {
            slidesPerView: 'auto',
            spaceBetween: 12,
        });

        // 첫 번째 그룹원의 데이터 즉시 로드
        if (firstMemberSgdtIdx) {
            await mem_schedule(firstMemberSgdtIdx);
        }
    }

    // generateMemberItems 함수도 수정
    function generateMemberItems(data, firstMemberSgdtIdx) {
        let html = '';
        let currentUserHtml = '';
        
        Object.keys(data.members).forEach(sgdt_idx => {
            const member = data.members[sgdt_idx];
            const isCurrentUser = sgdt_idx == <?= $sgdt_row['sgdt_idx'] ?>;
            const mt_nickname = member.member_info.mt_nickname ? member.member_info.mt_nickname : member.member_info.mt_name;
            
            const memberHtml = `
                <div class="swiper-slide checks mem_box">
                    <label>
                        <input type="radio" name="rd2" ${sgdt_idx == firstMemberSgdtIdx ? 'checked' : ''} onclick="mem_schedule(${sgdt_idx});">
                        <div class="prd_img mx-auto">
                            <div class="rect_square rounded_14">
                                <img src="${member.member_info.my_profile}" alt="<?= $translations['txt_profile_image'] ?>" onerror="this.src='<?= $ct_no_profile_img_url ?>'" />
                            </div>
                        </div>
                        <p class="fs_12 fw_400 text-center mt-2 line_h1_2 line2_text text_dynamic">${mt_nickname}</p>
                    </label>
                </div>`;

            if (isCurrentUser) {
                currentUserHtml = memberHtml;
            } else {
                html += memberHtml;
            }
        });

        // 본인 정보를 마지막에 추가
        html += currentUserHtml;

        // 그룹원추가 버튼 추가
        html += `
            <div class="swiper-slide mem_box add_mem_box" ${data.owner_count > 0 ? 'onclick="location.href=\'./group\'"' : 'style="visibility: hidden;"'}>
                <button class="btn mem_add">
                    <i class="xi-plus-min fs_20"></i>
                </button>
                <p class="fs_12 fw_400 text-center mt-1 line_h1_2 text_dynamic" style="word-break: break-all; line-height: 1.2; white-space: normal; overflow: visible;">
                    <?= $translations['txt_add_member'] ?>
                </p>
            </div>
        `;

        return html;
    }

    function calcScreenOffset() {
        let optBottomMaxHeight = 0;
        let optBottomMinHeight = 0;
        let optBottomDifference = 0;

        if (optBottom) {
            optBottomMaxHeight = 500;
            optBottomMinHeight = 250;
            optBottomDifference = optBottomMaxHeight - optBottomMinHeight;
        }

        verticalCenterOffset = (mapHeight - optBottomMaxHeight + optBottomDifference / 2) / 2;
    }

    function clearAllMapElements() {
        clearMapElements(profileMarkers);
        clearMapElements(scheduleMarkers);
        clearMapElements(markers);
        // clearMapElements(logMarkers);
        clearPolylines(); // 폴리라인을 위한 새로운 함수 사용
    }

    function clearMapElements(elements) {
        if (elements && elements.length > 0) {
            elements.forEach(element => {
                if (element.setMap) {
                    element.setMap(null); // 지도에서 요소 제거
                }
            });
            elements.length = 0; // 배열 초기화
        }
    }

    function clearPolylines() {
        if (polylines && polylines.length > 0) {
            polylines.forEach(polyline => {
                if (polyline.setMap) {
                    polyline.setMap(null); // 지도에서 폴리라인 제거
                }
            });
            polylines.length = 0; // 배열 초기화
        }
    }

    function processRouteData(responseData, walkData) {
        // JSON 문자열을 객체로 파싱
        let data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;

        // sllt_json_text 생성
        let sllt_json_text = [];
        data.features.forEach(feature => {
            if (feature.geometry.type === "LineString") {
                feature.geometry.coordinates.forEach(coord => {
                    let latlng = new Tmapv2.Point(coord[0], coord[1]);
                    let convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(latlng);
                    sllt_json_text.push({
                        lat: convertPoint._lat,
                        lng: convertPoint._lng,
                        color: "#ff0000" // 모든 점에 대해 동일한 색상 사용
                    });
                });
            }
        });

        // sllt_json_walk 생성
        let walkDataParsed = JSON.parse(walkData);
        let sllt_json_walk = walkDataParsed.map(item => ({
            distance: parseFloat(item[1]).toFixed(2),
            duration: item[0]
        }));

        return {
            sllt_json_text: JSON.stringify(sllt_json_text),
            sllt_json_walk: JSON.stringify(sllt_json_walk)
        };
    }

    // 로딩 화면을 보이게 하는 함수
    function showMapLoading(center = true) {
        const spinnerDots = document.querySelectorAll('.dot'); // 모든 .dot 요소 선택
        // const otherSpinnerDots = document.querySelectorAll('.mt-2.mb-3.px_16 .dot'); // .mt-2.mb-3.px_16의 .dot 요소 선택

        // 랜덤 색상 적용
        const randomColor = generateSpinnerColor();

        // 두 스피너의 색상 변경
        spinnerDots.forEach(dot => {
            dot.style.backgroundColor = randomColor;
        });
        // otherSpinnerDots.forEach(dot => {
        //     dot.style.backgroundColor = randomColor;
        // });

        loadingElement.style.display = 'flex'; // 로딩바 표시
        // optBottom 이벤트 비활성화
        // optBottom.ontouchstart = null;
        // optBottom.ontouchmove = null;
        // optBottom.onmousedown = null;
        // document.onmousemove = null;
        // document.onmouseup = null;
    }

    // 로딩 화면을 숨기는 함수
    function hideMapLoading() {
        document.getElementById("map-loading").style.display = 'none';
    }

    function generateSpinnerColor() {
        const colorSets = [
            '#FF0000', // 빨간색
            '#FFA500', // 주황색
            '#0000FF', // 파란색
            '#000080', // 남색
            '#800080', // 보라색
        ];

        const randomIndex = Math.floor(Math.random() * colorSets.length);
        return colorSets[randomIndex];
    }

    async function fetchWeatherData() {
        var form_data = new FormData();
        form_data.append("act", "weather_get");

        $.ajax({
            url: "./index_update",
            enctype: "multipart/form-data",
            data: form_data,
            type: "POST",
            async: true,
            contentType: false,
            processData: false,
            cache: true,
            timeout: 5000,
            success: function(data) {
                if (data) {
                    $('#top_weather_box').empty(); // 섹션 비우기
                    $('#top_weather_box').html(data);
                    try {
                        my_location_update();
                        // 광고보기 후 로그 표시 GA 이벤트 전송
                        gtag('event', 'index_ad', {
                            'event_category': 'show_log',
                            'event_label': 'show',
                            'user_id': '<?= $_SESSION['_mt_idx'] ?>',
                            'platform': isAndroidDevice() ? 'Android' : (isiOSDevice() ? 'iOS' : 'Unknown')
                        });
                    } catch (err) {
                        console.log("Error in my_location_update: " + err);
                    }
                }
            },
            error: function(err) {
                console.log(err);
            },
        });
    }

    function loadMemberSchedule(sgdt_idx) {
        // sessionStorage에서 데이터를 먼저 확인
        let cachedData = sessionStorage.getItem('groupMemberData_' + sgdt_idx);
        if (cachedData) {
            // 캐싱된 데이터가 있으면 사용
            let response = JSON.parse(cachedData);
            if (response.result === 'Y') {
                generateScheduleHTML(response.members[sgdt_idx], sgdt_idx);
                return response; // 함수 종료
            }
        }
        return new Promise((resolve, reject) => {
            var form_data = new FormData();
            form_data.append("act", "member_schedule_list");
            form_data.append("sgdt_idx", sgdt_idx);
            form_data.append("event_start_date", '<?= $s_date ?>');
            form_data.append("mt_lang", '<?= $userLang ?>');

            console.log('AJAX 요청 시작');
            $.ajax({
                url: "./schedule_update",
                enctype: "multipart/form-data",
                data: form_data,
                type: "POST",
                async: true,
                contentType: false,
                processData: false,
                cache: true,
                timeout: 5000,
                dataType: 'json',
                success: function(data) {
                    console.log('loadMemberSchedule - AJAX 요청 성공, 받은 데이터:', data);
                    if (data.result === 'Y') {
                        console.log('generateScheduleHTML 호출');
                        sessionStorage.setItem('groupMemberData_' + sgdt_idx, JSON.stringify(data));
                        if (data.members[sgdt_idx]) {
                            generateScheduleHTML(data.members[sgdt_idx], sgdt_idx);
                        } else {
                            //가입 후 그룹을 생성하지 않았을 경우 본인 정보 표시 sgdt_idx값 없음, schedule_update에서 mt_idx로 데이터 조회 하였음.
                            generateScheduleHTML(data.members[<?= $_SESSION['_mt_idx'] ?>], <?= $_SESSION['_mt_idx'] ?>);
                        }
                        resolve(data);
                    } else {
                        console.log("No loadMemberSchedule data available");
                        resolve(null);
                    }
                },
                error: function(err) {
                    console.error('AJAX request failed: ', err);
                    reject(err);
                },
            });
        });
    }

    function trackButtonClick() {
        gtag('event', 'show_optimal_path', {
            'event_category': 'optimal_path',
            'event_label': 'show',
            'user_id': '<?= $_SESSION['_mt_idx'] ?>',
            'platform': isAndroid() ? 'Android' : (isiOS() ? 'iOS' : 'Unknown')
        });
    }

    function generateScheduleHTML(data, sgdt_idx) {
        // 데이터 유효성 검사 추가
        if (!data || !data.member_info) {
            console.error('Invalid data structure:', data);
            return;
        }

        // 1. 위치 정보 업데이트
        const locationContailer = document.getElementById('my_location_div');
        locationContailer.innerHTML = '';

        // 4. 현재 주소 표시
        let mt_sido = data.member_info.mt_sido || '';
        let mt_gu = data.member_info.mt_gu || '';
        let mt_dong = data.member_info.mt_dong || '';
        let address = '';

        address = updateAddress(mt_sido, mt_gu, mt_dong);

        // 안전하게 데이터 접근
        const batteryInfo = data.battery_info || {};
        const locationInfo = data.location_info || {};
        const movingText = (locationInfo.mlt_speed > 1) ? '<?= $translations['txt_moving'] ?>' : '';
        const batteryPercentage = locationInfo.mlt_battery !== undefined ? `${locationInfo.mlt_battery}%` : '?';

        let locationHTML = `
            <div class="border-bottom pb-3">
                <div class="task_header_tit">
                    <p class="fs_16 fw_600 line_h1_2 mr-3"><?= $translations['txt_current_location'] ?></p>
                    <div class="d-flex align-items-center justify-content-end">
                        <p class="move_txt fs_13 mr-3" style="color: ${batteryInfo.color || ''}">${movingText}</p>
                        <p class="d-flex bettery_txt fs_13">
                            <span class="d-flex align-items-center flex-shrink-0 mr-2">
                                <img src="${batteryInfo.image || ''}" width="14px" class="battery_img" alt="베터리시용량">
                            </span>
                            <span class="battery_percentage" style="color: ${batteryInfo.color || ''}">${batteryPercentage}</span>
                        </p>
                    </div>
                </div>
                <p class="fs_14 fw_500 text_light_gray text_dynamic line_h1_3 mt-2" style="white-space: pre-line;">${address}</p>
            </div>
        `;

        locationContailer.innerHTML = locationHTML;

        // 2. 일정 컨테이너 업데이트
        const scheduleContainer = document.querySelector('.task_body_cont');
        scheduleContainer.innerHTML = ''; // 기존 내용 지우기

        if (data.schedules.length === 0) {
            // 일정 없을 때 메시지 표시
            scheduleContainer.innerHTML = `
                <div class="pt-5">
                    <button type="button" class="btn w-100 rounded add_sch_btn" onclick="trackButtonClick(); location.href='./schedule_form?sdate=<?= $s_date ?>&sgdt_idx=${sgdt_idx}'">
                        <i class="xi-plus-min mr-3"></i> <?= $translations['txt_add_lets_schedule'] ?>
                    </button>
                </div>
            `;
        } else {
            // 3. 일정 정보를 담은 HTML 생성
            let scheduleSpecificHTML = `
                    <div class="task_body_tit">
                        <p class="fs_16 fw_600 line_h1_2"><?= $translations['txt_schedule'] ?><span class="text_light_gray fs_14 ml-1">(${data.schedules.length} <?= $translations['txt_items'] ?>)</span></p>
                        <button type="button" class="btn fs_12 fw_500 h-auto w-auto text-primary optimal_btn" onclick="pedestrian_path_modal('${data.schedules[0].sgdt_idx}')"><?= $translations['txt_show_optimal_route_button'] ?><i class="xi-angle-right-min fs_13"></i></button>
                    </div>
                    <div class="task_body_cont num_point_map">
                        <div class="">
                            <div class="swiper task_slide">
                                <div class="swiper-wrapper" aria-live="polite">
                                    ${data.schedules.map((item, index) => `
                                        <div class="swiper-slide task_point_box" onclick="map_panto('${item.sst_location_lat}','${item.sst_location_long}')" role="group" aria-label="${index + 1} / ${data.schedules.length}" style="width: 45.5px;">
                                            <div class="task point_${getPointStatus(item)}">
                                                <span class="point_inner">
                                                    <span class="point_txt">${index + 1}</span>
                                                </span>
                                            </div>
                                            <p class="text_lightgray fs_13 mt-1 status_txt ${getPointStatus(item)}_txt">${getStatusText(item)}</p>
                                        </div>
                                        ${index < data.schedules.length - 1 ? '<div class="swiper-slide optimal_box"></div>' : ''}
                                    `).join('')}
                                </div>
                                <div class="swiper-pagination swiper-pagination-clickable swiper-pagination-bullets swiper-pagination-horizontal swiper-pagination-lock"><span class="swiper-pagination-bullet swiper-pagination-bullet-active" tabindex="0" role="button" aria-label="Go to slide 1" aria-current="true"></span></div>
                            <span class="swiper-notification" aria-live="assertive" aria-atomic="true"></span></div>
                        </div>
                    </div>
            `;

            if (data) {
                state.pathData = JSON.parse(data.sllt_json_text);
                state.walkingData = JSON.parse(data.sllt_json_walk);
                state.isDataLoaded = true;

                // state.pathData를 pedestrianData 형식으로 가공
                const processedPathData = {
                    members: {
                        [sgdt_idx]: {
                            sllt_json_walk: JSON.stringify(state.walkingData)
                        }
                    }
                };

                // state.pathData가 null이 아니고 배열이며 데이터가 있는 경우에만 함수 실행
                if (state.pathData !== null && Array.isArray(state.pathData) && state.pathData.length > 0) {
                    createOrUpdateSlidesForMember(sgdt_idx, processedPathData);
                } else {
                    // pathData가 null이거나 빈 배열인 경우 다른 함수 실행
                    f_get_box_list();
                    f_get_box_list2();
                }
            }

            // 4. 생성된 HTML을 컨테이너에 추가 (현재 위치 정보 먼저 추가)
            scheduleContainer.innerHTML = scheduleSpecificHTML;

            // 5. Swiper 슬라이드 다시 초기화
            if (typeof task_swiper !== 'undefined') {
                task_swiper.destroy();
            }
            task_swiper = new Swiper(".task_slide", {
                slidesPerView: 8,
                pagination: {
                    el: ".task_slide .swiper-pagination",
                    clickable: true,
                },
            });
        }
    }

    function getPointStatus(item) {
        const currentDate = new Date();
        const scheduleStartDate = new Date(item.sst_sdate);
        const scheduleEndDate = new Date(item.sst_edate);

        if (item.sst_all_day === 'Y') {
            return 'ing';
        } else if (currentDate >= scheduleEndDate) {
            return 'done';
        } else if (currentDate >= scheduleStartDate && currentDate <= scheduleEndDate) {
            return 'ing';
        } else {
            return 'gonna';
        }
    }

    function getStatusText(item) {
        const currentDate = new Date();
        const scheduleStartDate = new Date(item.sst_sdate);
        const scheduleEndDate = new Date(item.sst_edate);

        if (item.sst_all_day === 'Y') {
            return "<?= $translations['txt_all_day'] ?>";
        } else if (currentDate >= scheduleEndDate) {
            return "<?= $translations['txt_complete'] ?>";
        } else if (currentDate >= scheduleStartDate && currentDate <= scheduleEndDate) {
            return "<?= $translations['txt_in_progress'] ?>";
        } else {
            return "<?= $translations['txt_scheduled'] ?>";
        }
    }

    // 디바운스 함수
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function processPathDataGoogle(data, sgdt_idx) {
        if (!data || !data.members || !data.members[sgdt_idx]) {
            console.warn("Invalid data structure");
            return;
        }

        const memberData = data.members[sgdt_idx];
        if (!memberData.sllt_json_text || !memberData.sllt_json_walk) {
            console.warn("No path data available");
            return;
        }

        try {
            state.pathData = JSON.parse(memberData.sllt_json_text);
            state.walkingData = JSON.parse(memberData.sllt_json_walk);
            state.isDataLoaded = true;

            if (!Array.isArray(state.pathData)) {
                console.warn("Invalid path data format");
                return;
            }

            // 지도에 경로 그리기
            if (state.pathData.length > 0) {
                drawPathOnMap();
            } else {
                console.log("No path coordinates available");
            }
        } catch (error) {
            console.error("Error processing path data:", error);
            state.pathData = [];
            state.walkingData = [];
            state.isDataLoaded = false;
        }
    }

    function drawPathOnMap() {
        if (!Array.isArray(state.pathData) || state.pathData.length === 0 || !map) {
            console.log("Path data or map not available or invalid format");
            return;
        }

        console.log("Drawing path on map");

        // 기존 폴리라인 제거
        clearMapElements(polylines);

        // 경로 좌표 배열 생성
        const pathCoordinates = state.pathData.map(
            coord => new naver.maps.LatLng(coord.lat, coord.lng)
        );

        // 색상 그라데이션 생성
        const gradient = createGradient(pathCoordinates.length);

        // 각 구간별로 다른 색상의 폴리라인 생성
        for (let i = 0; i < pathCoordinates.length - 1; i++) {
            const polyline = new naver.maps.Polyline({
                path: [pathCoordinates[i], pathCoordinates[i + 1]],
                strokeColor: gradient[i],
                strokeWeight: 5,
                strokeOpacity: 0.5,
                map: map
            });
            polylines.push(polyline);
        }

        console.log("Path drawn on map");
    }

    async function mem_schedule(sgdt_idx, mlt_lat = 37.5666805, mlt_lng = 126.9784147) {
        console.log('-----------------------------------');
        console.log('함수 호출: mem_schedule');
        console.log('매개변수:', {
            sgdt_idx,
            mlt_lat,
            mlt_lng
        });

        try {
            console.log('showMapLoading 호출');
            showMapLoading();

            // 1. 경로 데이터를 먼저 로드
            const pathData = await pedestrian_path_check(sgdt_idx).catch(error => {
                console.warn('경로 데이터 로드 실패:', error);
                return null; // 경로 데이터 로드 실패시 null 반환하고 계속 진행
            });

            // 2. 경로 데이터 로드 후 멤버 데이터와 스케줄 데이터 로드
            const memberScheduleData = await loadMemberSchedule(sgdt_idx);
            if (!memberScheduleData) {
                throw new Error('멤버 스케줄 데이터를 불러오는데 실패했습니다.');
            }

            console.log("받은 데이터:", memberScheduleData);

            // 3. 지도 초기화
            await initializeMapAndMarkers(memberScheduleData.members, sgdt_idx);

            // 4. 지도 초기화 완료 후 마커 및 경로 표시
            if (map) {
                naver.maps.Event.addListener(map, 'idle', () => {
                    // 경로 데이터가 있다면 지도에 경로 표시
                    if (pathData && pathData.members && pathData.members[sgdt_idx]) {
                        processPathDataGoogle(pathData, sgdt_idx);
                        console.log('경로 그리기 함수 호출');
                        drawPathOnMap();
                    }
                });

                // 5. 현재 주소 표시
                if (memberScheduleData.members[sgdt_idx] && memberScheduleData.members[sgdt_idx].member_info) {
                    const memberInfo = memberScheduleData.members[sgdt_idx].member_info;
                    let address = updateAddress(
                        memberInfo.mt_sido || '',
                        memberInfo.mt_gu || '',
                        memberInfo.mt_dong || ''
                    );

                    console.log('f_my_location_btn 호출');
                    f_my_location_btn(memberInfo.mt_idx);
                } else {
                    // 가입 후 그룹을 생성하지 않았을 경우 본인 정보 표시
                    const defaultMemberInfo = memberScheduleData.members[<?= $_SESSION['_mt_idx'] ?>].member_info;
                    if (defaultMemberInfo) {
                        f_my_location_btn(defaultMemberInfo.mt_idx);
                    }
                }
            }

            console.log("Map data and member schedule loaded successfully");
        } catch (error) {
            console.error("Failed to load map data or member schedule:", error);
            showErrorToUser("지도 또는 일정 정보를 불러오는 데 실패했습니다. 다시 시도해 주세요.");
        } finally {
            console.log('hideMapLoading 호출');
            hideMapLoading();
        }
    }

    function updateAddress(mt_sido, mt_gu, mt_dong) {
        // 주소 중복 제거 로직
        let fullAddress = '';
        if (mt_sido) {
            fullAddress += mt_sido;
            if (mt_gu && !mt_gu.startsWith(mt_sido)) {
                fullAddress += ' ' + mt_gu;
            }
            if (mt_dong && !mt_dong.startsWith(mt_sido) && !mt_dong.startsWith(mt_gu)) {
                fullAddress += ' ' + mt_dong;
            }
        } else if (mt_gu) {
            fullAddress += mt_gu;
            if (mt_dong && !mt_dong.startsWith(mt_gu)) {
                fullAddress += ' ' + mt_dong;
            }
        } else if (mt_dong) {
            fullAddress += mt_dong;
        }

        // HTML 요소를 찾아 내용을 변경
        let addressElement = document.querySelector('p.fs_14.fw_500.text_light_gray.text_dynamic.line_h1_3.mt-2');
        if (addressElement) {
            addressElement.textContent = fullAddress;
            console.log('주소가 성공적으로 업데이트되었습니다.');
        } else {
            console.log("주소를 표시할 요소를 찾을 수 없습니다.");
        }
        return fullAddress;
    }

    async function createOrUpdateSlidesForMember(memberId, pedestrianData) {
        console.log("Creating or updating slides for member", memberId);

        if (!groupMemberSlides[memberId]) {
            groupMemberSlides[memberId] = Array.from(document.querySelectorAll('.swiper-slide.optimal_box'));
        }

        const slidesContainers = groupMemberSlides[memberId];

        if (pedestrianData && pedestrianData.members[memberId] && pedestrianData.members[memberId].sllt_json_walk) {
            const walkingData = JSON.parse(pedestrianData.members[memberId].sllt_json_walk);
            console.log("Walking data parsed", walkingData);

            await waitForDOM();

            walkingData.forEach((leg, index) => {
                const duration = leg.duration !== undefined ? leg.duration : "";
                const distance = leg.distance !== undefined ? leg.distance : "";

                const slideSelector = `.swiper-slide.optimal_box[aria-label^="${((index + 1) * 2)} / "]`;
                const slides = document.querySelectorAll(slideSelector);
                slides.forEach(slide => {
                    slide.innerHTML =
                        duration || distance ?
                        `
                        <p class="fs_23 fw_700 optimal_time">${duration}<span class="fs_14"><?= $translations['txt_minute'] ?></span></p>
                        <p class="fs_12 text_light_gray optimal_tance">${distance}km</p>
                        ` :
                        "";
                    console.log(`Slide ${index + 1} updated for member ${memberId}`);
                });
            });
        } else {
            console.log("No walking data available, setting loading state");
            slidesContainers.forEach(container => {
                container.innerHTML = `
                    <div class="optimal_time loading-animation"></div>
                    <div class="optimal_tance loading-animation"></div>
                `;
            });
        }
    }

    function waitForDOM() {
        return new Promise(resolve => {
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                setTimeout(resolve, 0);
            } else {
                document.addEventListener('DOMContentLoaded', resolve);
            }
        });
    }

    // 페이지 로드 시 초기화
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOM fully loaded and parsed");
        // 여기에 필요한 초기화 로직을 추가할 수 있습니다.
    });

    async function initializeMapAndMarkers(data, sgdt_idx) {
        console.log('initializeMapAndMarkers 함수 시작');
        console.log('매개변수:', {
            data,
            sgdt_idx
        });

        if ('ko' === '<?= $userLang ?>' && '<?= $mem_row['mt_map'] ?>' == 'N') {
            console.log('네이버 지도 초기화 시작');
            await initNaverMap(data, sgdt_idx);
            console.log('네이버 지도 초기화 완료');
        } else {
            console.log('네이버 지도 초기화 시작');
            await initGoogleMap(data, sgdt_idx);
            console.log('네이버 지도 초기화 완료');
        }
    }

    function showErrorToUser(message) {
        // 사용자에게 오류 메시지를 표시하는 함수
        // 예: alert(message) 또는 더 세련된 UI 요소 사용
        alert(message);
    }

    // Ensure this function is attached to a button correctly
    // document.getElementById('yourButtonId').onclick = showAdWithAdData;
    // 최적경로 구하기
    function showOptimalPath(startX, startY, endX, endY, scheduleMarkerCoordinates, scheduleStatus) {
        // 초기화 작업
        let viaPoints = [];
        let passList = '';
        let totalWalkingTimeJson = null;
        let requestData = {};

        // 스케줄 마커들의 좌표를 추출하여 경유지로 설정
        viaPoints = scheduleMarkerCoordinates.map(function(coordinate, index) {
            if (index === 0 || index === scheduleMarkerCoordinates.length - 1) {
                // 출발지 또는 도착지인 경우, 무시하고 continue
                return null;
            }
            return {
                "viaPointId": "point_" + index,
                "viaPointName": "point_" + index,
                "viaY": coordinate.y || coordinate._lat || coordinate.lat, // coordinate.y가 존재하면 사용하고, 없다면 coordinate._lat 사용
                "viaX": coordinate.x || coordinate._lng || coordinate.lng, // coordinate.x가 존재하면 사용하고, 없다면 coordinate._lng 사용
                "viaTime": 600
            };
        }).filter(function(point) {
            return point !== null; // 출발지와 도착지를 제외하기 위해 null을 제거
        });

        // 좌표만을 추출하여 passList에 저장
        passList = viaPoints.map(function(point) {
            // 좌표값을 EPSG3857로 변환
            var latlng = new Tmapv2.Point(point.viaY, point.viaX);
            var convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(latlng);
            return point.viaX + "," + point.viaY;
        }).join("_");

        // 직선거리 계산
        const distance = getDistance(startY, startX, scheduleMarkerCoordinates, 5);
        const straightDistance = distance.toFixed(2);
        if (straightDistance >= 5) {
            jalert('<?= $translations['txt_schedules_too_far'] ?>' + straightDistance + '<?= $translations['txt_km'] ?>');
            return false;
        }

        // passList가 존재할 때만 데이터에 passList를 포함시킴
        requestData = {
            "reqCoordType": "WGS84GEO",
            "resCoordType": "EPSG3857",
            "startName": "출발",
            "startX": startY, // 수정
            "startY": startX, // 수정
            "endName": "도착",
            "endX": endY, // 수정
            "endY": endX, // 수정
            "endID": "goal",
        };

        if (passList) {
            requestData.passList = passList; // 경유지 좌표값 추가
        }

        const dataToSend = JSON.stringify(requestData);

        var headers = {};
        headers["appKey"] = "6BGAw3YxGA6tVPu0Olbio7fwXiGjDV7g4VRlF3Pq";

        // 최적 경로 요청
        $.ajax({
            method: "POST",
            headers: headers,
            url: "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json&callback=result",
            async: false,
            contentType: "application/json",
            data: dataToSend,
            success: function(response) {
                if (response && response.features && response.features.length > 0) {
                    var resultData = response.features;
                    var totalidstance = ((resultData[0].properties.totalDistance) / 1000).toFixed(1);
                    var totalTime = ((resultData[0].properties.totalTime) / 60).toFixed(0);

                    var elementWithAriaLabel = $('.optimal_box').filter(function() {
                        return $(this).attr('aria-label') !== undefined;
                    });

                    var labelText = elementWithAriaLabel.attr('aria-label').split('/')[1].trim();

                    // 각 경유지까지의 예상 소요 시간 계산 함수 호출
                    calculateWalkingTime(startX, startY, endX, endY, scheduleMarkerCoordinates, function(totalWalkingTime) {
                        totalWalkingTimeJson = totalWalkingTime;
                    });

                    // 성공 시 ajax로 DB에 log json 추가
                    var sgdt_idx = $('#pedestrian_path_modal_sgdt_idx').val();

                    let result = processRouteData(JSON.stringify(response), JSON.stringify(totalWalkingTimeJson));

                    var form_data = new FormData();
                    form_data.append("act", "loadpath_add");
                    form_data.append("sgdt_idx", sgdt_idx);
                    form_data.append("sllt_json_text", result.sllt_json_text);
                    form_data.append("sllt_json_walk", result.sllt_json_walk);
                    form_data.append("event_start_date", '<?= $s_date ?>');
                    form_data.append("sllt_language", '<?= $userLang ?>');

                    $.ajax({
                        url: "./schedule_update",
                        enctype: "multipart/form-data",
                        data: form_data,
                        type: "POST",
                        async: true,
                        contentType: false,
                        processData: false,
                        cache: true,
                        timeout: 5000,
                        success: function(data) {
                            if (data != 'Y') {
                                jalert('<?= $translations['txt_invalid_access'] ?>');
                            }
                        },
                        error: function(err) {
                            console.log(err);
                        },
                    });

                    // 최적경로 표시 GA 이벤트 전송
                    gtag('event', 'show_optimal_path', {
                        'event_category': 'optimal_path',
                        'event_label': 'show',
                        'user_id': '<?= $_SESSION['_mt_idx'] ?>',
                        'platform': isAndroidDevice() ? 'Android' : (isiOSDevice() ? 'iOS' : 'Unknown')
                    });
                } else {
                    jalert('<?= $translations['txt_failed_to_get_route_data'] ?>');
                }
            },
            error: function(request, status, error) {
                console.log(request.responseJSON.error.code);
                console.log(request.responseJSON.error);
                if (request.responseJSON.error.code == '3102') {
                    var errorMessage = '<?= $translations['txt_service_not_supported'] ?>';
                } else if (request.responseJSON.error.code == '3002') {
                    var errorMessage = '<?= $translations['txt_no_directions_available'] ?>';
                } else if (request.responseJSON.error.code == '1009') {
                    var errorMessage = '<?= $translations['txt_sections_too_far'] ?>';
                } else if (request.responseJSON.error.code == '9401') {
                    var errorMessage = '<?= $translations['txt_need_2_schedules'] ?>';
                } else if (request.responseJSON.error.code == '1100') {
                    var errorMessage = '<?= $translations['txt_max_7_schedules'] ?>';
                } else if (request.responseJSON.error.code == '2200') {
                    var errorMessage = '<?= $translations['txt_address_not_supported'] ?>';
                } else {
                    var errorMessage = '<?= $translations['txt_system_error'] ?>';
                }

                jalert(errorMessage);
            }
        });

        pedestrian_path_check($('#pedestrian_path_modal_sgdt_idx').val());
    }

    async function pedestrian_path_check(sgdt_idx) {
        console.log('pedestrian_path_check 함수 시작, sgdt_idx:', sgdt_idx);
        if (!sgdt_idx) {
            console.error('Invalid sgdt_idx:', sgdt_idx);
            return null;
        }

        try {
            const form_data = new FormData();
            form_data.append("act", "pedestrian_path_chk");
            form_data.append("sgdt_idx", sgdt_idx);
            form_data.append("event_start_date", '<?= $s_date ?>');

            console.log('AJAX 요청 시작');
            const response = await $.ajax({
                url: "./schedule_update",
                enctype: "multipart/form-data",
                data: form_data,
                type: "POST",
                contentType: false,
                processData: false,
                cache: true,
                timeout: 5000,
                dataType: 'json'
            });

            console.log('pedestrian_path_check - AJAX 요청 성공, 받은 데이터:', response);
            
            if (response && response.result === 'Y' && response.members && response.members[sgdt_idx]) {
                if ('ko' === '<?= $userLang ?>' && '<?= $mem_row['mt_map'] ?>' == 'N') {
                    console.log('네이버 지도 경로 데이터 처리');
                    processPathDataNaver(response, sgdt_idx);
                } else {
                    console.log('구글 지도 경로 데이터 처리');
                    processPathDataGoogle(response, sgdt_idx);
                    console.log('경로 그리기 함수 호출');
                    drawPathOnMap();
                }
                return response;
            } else {
                console.log("No path data available or result is not 'Y' or no sllt_json_text");
                if (response && response.message) {
                    console.warn("Server message:", response.message);
                }
                return null;
            }
        } catch (error) {
            console.error('AJAX request failed:', error);
            if (error.responseText) {
                try {
                    const errorData = JSON.parse(error.responseText);
                    console.error('Parsed error data:', errorData);
                } catch (e) {
                    console.error('Could not parse error response as JSON:', error.responseText);
                }
            }
            return null;
        }
    }

    //최적경로 표시 모달 띄우기
    function pedestrian_path_modal(sgdt_idx) {
        if (sgdt_idx) {
            $('#pedestrian_path_modal_sgdt_idx').val(sgdt_idx);
        }
        var form_data = new FormData();
        form_data.append("act", "load_path_chk");
        form_data.append("sgdt_idx", sgdt_idx);
        form_data.append("event_start_date", '<?= $s_date ?>');
        $.ajax({
            url: "./schedule_update",
            enctype: "multipart/form-data",
            data: form_data,
            type: "POST",
            async: true,
            contentType: false,
            processData: false,
            cache: true,
            timeout: 5000,
            dataType: 'json',
            success: function(data) {
                // console.log(data);
                sessionStorage.clear();
                if (data.result == 'Y' && data.path_count_day == 0) {
                    $('#pathType').text(data.path_type); // 모달에 표시
                    $('#pathCountday').text("<?= $translations['txt_all_optimal_routes_used'] ?>"); // 모달에 표시
                    $('#pathCountmonth').text(data.path_count_month + " <?= $translations['txt_month_cnt_available'] ?>"); // 모달에 표시
                    $('#showPathButton').removeClass('d-none');
                    $('#showPathAdButton').addClass('d-none');
                    $('#showPathButton').prop('disabled', true);
                    $('#path_day_count').val(data.path_count_day);
                    if (data.path_type == 'Pro') {
                        $('#pathContent').addClass('d-none');
                    } else {
                        $('#pathContent').removeClass('d-none');
                    }

                    $('#optimal_modal').modal('show');

                } else if (data.result == 'Y') {
                    $('#pathType').text(data.path_type); // 모달에 표시
                    $('#pathCountday').text(data.path_count_day + " <?= $translations['txt_day_cnt_available'] ?> "); // 모달에 표시
                    $('#pathCountmonth').text(data.path_count_month + " <?= $translations['txt_month_cnt_available'] ?>"); // 모달에 표시

                    if (data.ad_count == 0 && data.path_type == 'Basic') {
                        $('#showPathButton').addClass('d-none');
                        $('#showPathButton').prop('disabled', true);
                        $('#showPathAdButton').removeClass('d-none');
                        $('#showPathAdButton').prop('disabled', false);
                    } else {
                        $('#showPathButton').removeClass('d-none');
                        $('#showPathAdButton').addClass('d-none');
                        $('#showPathButton').prop('disabled', false);
                    }
                    $('#path_day_count').val(data.path_count_day);
                    if (data.path_type == 'Pro') {
                        $('#pathContent').addClass('d-none');
                    } else {
                        $('#pathContent').removeClass('d-none');
                    }
                    $('#optimal_modal').modal('show');
                } else if (data.result == 'Noschedule') {
                    jalert("<?= $translations['txt_need_2_schedules'] ?>");
                } else if (data.result == 'NoLocation') {
                    jalert("<?= $translations['txt_schedule_missing_location'] ?>");
                } else {
                    jalert('<?= $translations['txt_invalid_access'] ?>');
                }
            },
            error: function(err) {
                console.log(err);
            },
        });
    }

    //손으로 바텀시트 움직이기
    document.addEventListener("DOMContentLoaded", function() {
        // console.log('bottom');
        var startY = 0;
        var isDragging;

        if (optBottom) {
            optBottom.addEventListener("touchstart", function(event) {
                startY = event.touches[0].clientY; // 터치 시작 좌표 저장
            });
            optBottom.addEventListener("touchmove", function(event) {
                var currentY = event.touches[0].clientY; // 현재 터치 좌표
                var deltaY = currentY - startY; // 터치 움직임의 차이 계산

                // 움직임이 일정 값 이상이면 보이거나 숨김
                if (Math.abs(deltaY) > 50) {
                    var isVisible = deltaY < 0; // deltaY가 음수면 보이게, 양수면 숨기게
                    var newTransformValue = isVisible ? "translateY(0)" : "translateY(<?= $translateY ?>%)";
                    optBottom.style.transform = newTransformValue;
                }
            });


            optBottom.addEventListener('mousedown', function(event) {
                startY = event.clientY; // 클릭 시작 좌표 저장
                isDragging = true;
            });

            document.addEventListener('mousemove', function(event) {
                if (isDragging) {
                    var currentY = event.clientY; // 현재 마우스 좌표
                    var deltaY = currentY - startY; // 움직임의 차이 계산

                    // 움직임이 일정 값 이상이면 보이거나 숨김
                    if (Math.abs(deltaY) > 50) {
                        var isVisible = deltaY < 0; // deltaY가 음수면 보이게, 양수면 숨기게
                        var newTransformValue = isVisible ? 'translateY(0)' : 'translateY(<?= $translateY ?>%)';
                        optBottom.style.transform = newTransformValue;
                    }
                }
            });

            document.addEventListener('mouseup', function() {
                isDragging = false;
            });

        } else {
            console.error("요소를 찾을 수 없습니다.");
        }
    });

    function toggleInfobox() {
        var infoboxes = document.getElementsByClassName('infobox5');
        var img = document.getElementById('infoboxImg');

        // 이미지 경로 변경
        if (img.src.includes('ico_info_on.png')) {
            img.src = './img/ico_info_off.png';
            for (var i = 0; i < infoboxes.length; i++) {
                infoboxes[i].classList.remove('on');
            }
        } else {
            img.src = './img/ico_info_on.png';
            for (var i = 0; i < infoboxes.length; i++) {
                infoboxes[i].classList.add('on');
            }
        }

    }

    // 초대링크 닫을시
    function floating_link_cancel() {
        document.getElementById('first_floating_modal').classList.remove('on');
        document.getElementById('group_make_modal').classList.add('on');
    }
    //배너 슬라이더

    var ban_swiper = new Swiper(".banSwiper", {
        //     autoplay: {
        //         delay: 2500,
        //         disableOnInteraction: false,
        //   },
        autoHeight: true,
        pagination: {
            el: ".banSwiper .swiper-pagination",
            type: "fraction",
        },
        navigation: {
            nextEl: ".banSwiper .swiper-button-next",
            prevEl: ".banSwiper .swiper-button-prev",
        },
    });

    showPathButton.addEventListener('click', function(event) {
        var pathCount = document.getElementById('path_day_count');

        if (pathCount.value == 0) {
            jalert('<?= $translations['txt_all_optimal_routes_used'] ?>');
            return;
        }

        // 구글 지오코딩 대신 네이버 맵스를 직접 사용
        Promise.resolve(showOptimalPath(startX, startY, endX, endY, scheduleMarkerCoordinates, scheduleStatus))
            .catch(error => {
                console.error("showOptimalPath Error:", error);
                return showGoogleOptimalPath(startX, startY, endX, endY, scheduleMarkerCoordinates, scheduleStatus);
            })
            .finally(() => {
                loadMemberSchedule($('#pedestrian_path_modal_sgdt_idx').val());
                $('#optimal_modal').modal('hide');
            });
    });

    function getAdData() {
        return <?= $ad_data ?>;
    }

    // 경로 데이터 처리 - 네이버 지도
    function processPathDataNaver(data, sgdt_idx) {
        if (!data.members[sgdt_idx].sllt_json_text) {
            console.warn("No sllt_json_text data available.");
            return; // 함수 실행 종료
        }

        var jsonString = data.members[sgdt_idx].sllt_json_text;
        // resultData를 JSON 객체로 변환
        const resultDataObj = JSON.parse(jsonString);

        if (!jsonString || jsonString.length === 0) {
            console.error("No features found in the JSON data.");
            return;
        }

        // 경로 그리기 및 마커 설정을 비동기적으로 처리
        setTimeout(() => {
            drawPathAndMarkers(map, resultDataObj);
            // updateOptimalBoxes(totalWalkingTime, labelText);
        }, 100);
    }

    function hideLoader() {
        if (typeof window.FakeLoader !== 'undefined' && typeof window.FakeLoader.hideOverlay === 'function') {
            window.FakeLoader.hideOverlay();
        } else {
            console.log("FakeLoader not available, hiding loader skipped");
        }
    }

    function retryDrawPath(map, resultData, totalWalkingTime, labelText, retryCount = 0) {
        if (retryCount >= 5) {
            console.error("Failed to draw the path after multiple attempts.");
            return;
        }

        console.warn(`Retrying to draw path, attempt: ${retryCount + 1}`);

        setTimeout(() => {
            drawPathAndMarkers(map, resultData);
            // updateOptimalBoxes(totalWalkingTime, labelText);

            if (!isPathDrawn(polylines)) {
                console.warn("Path not drawn correctly, retrying...");
                retryDrawPath(map, resultData, totalWalkingTime, labelText, retryCount + 1);
            }
        }, 1000 * (retryCount + 1)); // 재시도 간격을 점진적으로 늘립니다.
    }

    // isPathDrawn 함수 추가
    function isPathDrawn(polylines) {
        return polylines.length > 0 && polylines.every(polyline => polyline.getPath().getLength() > 0);
    }

    function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // 지구의 반지름 (km)
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c; // 두 지점 사이의 거리 (km)
        return d;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    function drawPathAndMarkers(map, resultData) {
        // 기존에 그려진 라인 & 마커가 있다면 초기화
        if (resultdrawArr.length > 0) {
            for (var i in resultdrawArr) {
                resultdrawArr[i].setMap(null);
            }
            resultdrawArr = [];
        }

        drawInfoArr = [];
        polylines = [];
        location_markers = [];

        // 전체 경로를 저장할 배열
        var path = [];

        // resultData 배열을 순회하며 path 배열에 좌표 추가
        for (var i = 0; i < resultData.length; i++) {
            var lat = resultData[i].lat;
            var lng = resultData[i].lng;
            var convertChange = new naver.maps.LatLng(lat, lng);
            path.push(convertChange);
        }

        // path 배열의 길이가 2 이상인 경우에만 폴리라인 생성
        if (path.length > 1) {
            // 그라데이션 생성
            const gradient = createGradient(path.length);

            // 여러 개의 폴리라인 생성
            for (let i = 0; i < path.length - 1; i++) {
                const partialPath = [path[i], path[i + 1]];

                var polyline = new naver.maps.Polyline({
                    path: partialPath,
                    strokeColor: gradient[i],
                    strokeOpacity: 0.5,
                    strokeWeight: 5,
                    map: map,
                });

                resultdrawArr.push(polyline);
                polylines.push(polyline);
            }
        }
    }

    function createGradient(pathLength) {
        const colors = [
            '#FF0000', // 빨간색
            '#FFA500', // 주황색
            '#FFFF00', // 노란색
            '#00FF00', // 초록색
            '#0000FF', // 파란색
            '#000080', // 남색
            '#800080', // 보라색
        ];
        const gradient = [];
        const steps = pathLength - 1;
        const colorSteps = colors.length - 1; // 색상 단계 수

        for (let i = 0; i <= steps; i++) {
            const colorIndex = Math.floor(i / steps * colorSteps); // 현재 색상 인덱스
            const nextColorIndex = Math.min(colorIndex + 1, colorSteps); // 다음 색상 인덱스
            const ratio = (i / steps * colorSteps) - colorIndex; // 현재 색상 구간 내 비율

            const color = interpolateColor(colors[colorIndex], colors[nextColorIndex], ratio);
            gradient.push(color);
        }

        return gradient;
    }

    // 두 색상 사이의 중간 색상 계산 함수
    function interpolateColor(color1, color2, ratio) {
        const hex = (number) => {
            const hexStr = number.toString(16);
            return hexStr.length === 1 ? '0' + hexStr : hexStr;
        };

        const r = Math.ceil(parseInt(color1.substring(1, 3), 16) * (1 - ratio) + parseInt(color2.substring(1, 3), 16) * ratio);
        const g = Math.ceil(parseInt(color1.substring(3, 5), 16) * (1 - ratio) + parseInt(color2.substring(3, 5), 16) * ratio);
        const b = Math.ceil(parseInt(color1.substring(5, 7), 16) * (1 - ratio) + parseInt(color2.substring(5, 7), 16) * ratio);

        return '#' + hex(r) + hex(g) + hex(b);
    }

    function isPathDrawn(polylines) {
        return polylines.length > 0;
    }

    function retryDrawPath(map, resultData, totalWalkingTime, labelText, retryCount = 0) {
        if (retryCount >= 5) { // 재시도 횟수 제한
            console.error("Failed to draw the path after multiple attempts.");
            return;
        }

        // 기존 데이터 초기화
        resultdrawArr.forEach(item => item.setMap(null));
        resultdrawArr = [];
        polylines = [];
        location_markers = [];

        console.warn(`Retrying to draw path, attempt: ${retryCount + 1}`);
        // drawPathAndMarkers(map, resultData);

        if (!isPathDrawn(polylines)) {
            console.warn("Path not drawn correctly, retrying...");
            setTimeout(() => {
                retryDrawPath(map, resultData, totalWalkingTime, labelText, retryCount + 1);
            }, 1000); // 1초 후 재시도
        }
    }

    // 라인 위 방향 표시
    function makeMarker(map, position1, position2, index) {
        var ICON_GAP = 0;
        var ICON_SPRITE_IMAGE_URL = './img/map_direction.svg';
        var iconSpritePositionX = (index * ICON_GAP) + 1;
        var iconSpritePositionY = 1;

        var marker = new naver.maps.Marker({
            map: map,
            position: position1,
            title: 'map_maker' + index,
            icon: {
                url: ICON_SPRITE_IMAGE_URL,
                size: new naver.maps.Size(8, 8), // 이미지 크기
                // origin: new naver.maps.Point(iconSpritePositionX, iconSpritePositionY), // 스프라이트 이미지에서 클리핑 위치
                anchor: new naver.maps.Point(4, 4), // 지도상 위치에서 이미지 위치의 offset
                scaledSize: new naver.maps.Size(8, 8),
                origin: new naver.maps.Point(0, 0),
            }
        });

        var angle_t = f_get_angle(position2['x'], position2['y'], position1['x'], position1['y']);
        // console.log(position1['x'], position1['y'], position2['x'], position2['y'], angle_t);

        $("div[title|='map_maker" + index + "'").css('transform', 'rotate(' + angle_t + 'deg)');

        return marker;
    }
    // 방향구하기
    function f_get_angle(lat1, lon1, lat2, lon2) {
        var lat1 = lat1 * Math.PI / 180;
        if (lat2 == '') {
            var lat2 = lat1 * Math.PI / 180;
            var lon2 = lon1;
        } else {
            var lat2 = lat2 * Math.PI / 180;
        }
        var dLon = (lon2 - lon1) * Math.PI / 180;

        var y = Math.sin(dLon) * Math.cos(lat2);
        var x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

        var brng = Math.atan2(y, x);

        return (((brng * 180 / Math.PI) + 360) % 360);
    }
    // 두 지점의 위도와 경도를 인자로 받아 직선거리를 계산하는 함수
    function getDistance(lon1, lat1, scheduleMarkerCoordinates, maxDistance) {
        // 경유지가 존재할 경우, 각 경유지 사이의 거리를 계산하여 총 거리에 더합니다.
        for (let i = 1; i < scheduleMarkerCoordinates.length; i++) {
            const curLat = scheduleMarkerCoordinates[i]._lat;
            const curLon = scheduleMarkerCoordinates[i]._lng;
            const segmentDistance = calculateSegmentDistance(lat1, lon1, curLat, curLon);

            // 현재까지의 총 거리와 경유지까지의 거리를 합산하여 최대 거리를 초과하는지 확인합니다.
            if (segmentDistance > maxDistance) {
                // 최대 거리를 초과하는 경우에는 반복문을 종료합니다.
                return segmentDistance;
                break;
            }

            // 다음 경유지부터 출발점으로 설정하여 새로운 segmentDistance를 계산합니다.
            lat1 = curLat;
            lon1 = curLon;
        }
        return 0;

    }
    // 두 지점 사이의 직선 거리를 계산하는 보조 함수
    function calculateSegmentDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 지구의 반지름 (단위: km)
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // 직선거리 (단위: km)
        return distance;
    }
    // 도(degree)를 라디안(radian)으로 변환하는 함수
    function deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
    // 출발점, 도착지, 경유지까지의 예상 소요 시간을 계산하는 함수
    function calculateWalkingTime(startX, startY, endX, endY, scheduleMarkerCoordinates, callback) {
        var arr_distance = [];
        var completedRequests = 0;

        // 두 번째 경유지부터 마지막 경유지까지의 예상 소요 시간 계산
        for (var i = 1; i < scheduleMarkerCoordinates.length; i++) {
            getWalkingTime(scheduleMarkerCoordinates[i - 1]._lat || scheduleMarkerCoordinates[i - 1].lat, scheduleMarkerCoordinates[i - 1]._lng || scheduleMarkerCoordinates[i - 1].lng, scheduleMarkerCoordinates[i]._lat || scheduleMarkerCoordinates[i].lat, scheduleMarkerCoordinates[i]._lng || scheduleMarkerCoordinates[i].lng, function(totalTime, totalidstance) {
                arr_distance.push([totalTime, totalidstance]);
                completedRequests++;

                // 모든 요청이 완료되었을 때 콜백 함수 호출
                if (completedRequests === scheduleMarkerCoordinates.length - 1) {
                    callback(arr_distance);
                }
            });
        }
    }
    // getWalkingTime 함수는 비동기적으로 실행되며, 결과는 콜백 함수를 통해 반환됩니다.
    function getWalkingTime(startX, startY, endX, endY, callback) {
        var apiKey = '6BGAw3YxGA6tVPu0Olbio7fwXiGjDV7g4VRlF3Pq';
        var apiUrl = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json&callback=result';

        // API 호출에 필요한 매개변수 설정
        var requestData = {
            "reqCoordType": "WGS84GEO",
            "resCoordType": "EPSG3857",
            "startName": "출발",
            "startX": startY, // 수정
            "startY": startX, // 수정
            "endName": "도착",
            "endX": endY, // 수정
            "endY": endX, // 수정
            "endID": "goal",
        };

        // API 요청 보내기
        $.ajax({
            method: "POST",
            url: apiUrl,
            headers: {
                "appKey": apiKey
            },
            contentType: "application/json",
            data: JSON.stringify(requestData),
            async: false, // 동기적 요청 (비동기적으로 설정할 경우 결과를 반환하기 전에 함수가 종료될 수 있음)
            success: function(response) {
                // API 응에서 예상 소요 시간 추출
                var totalTime = ((response.features[0].properties.totalTime) / 60).toFixed(0);
                var totalidstance = ((response.features[0].properties.totalDistance) / 1000).toFixed(1);
                // 결과를 콜백 함수를 통해 반환
                callback(totalTime, totalidstance);
            },
            error: function(xhr, status, error) {
                console.error('API 요청 실패:', error);
                // 에러 발생 시 콜백 함수를 호출하여 에러를 반환
                callback(-1, -1);
            }
        });
    }

    function my_location_update() {
        var sgdt_idx = $('#sgdt_idx').val();
        var form_data = new FormData();
        var mt_idx = '<?= $_SESSION['_mt_idx'] ?>';
        form_data.append("act", "member_location_reload");
        form_data.append("sgdt_idx", sgdt_idx);
        form_data.append("mt_idx", mt_idx);
        $.ajax({
            url: "./schedule_update",
            enctype: "multipart/form-data",
            data: form_data,
            type: "POST",
            async: true,
            contentType: false,
            processData: false,
            cache: true,
            timeout: 5000,
            success: function(data) {
                if (data) {
                    $('#my_location_div').empty(); // 섹션 비우기
                    $('#my_location_div').html(data);
                } else {
                    console.log("Error: No data returned");
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log("Error: " + textStatus + ", " + errorThrown);
            }
        });
    }

    // 지도 중심을 이동하는 map_panto 함수
    function map_panto(lat, lng) {
        currentLat = lat;
        currentLng = lng;
        if (previousTransformY === 'translateY(0px)') {
            panMapDown();
            console.log('panMapDown');
        } else {
            console.log('panMapUp');
            panMapUp();
        }
    }

    function f_my_location_btn(mt_idx) {
        console.log('f_my_location_btn 함수 시작, mt_idx:', mt_idx);
        var form_data = new FormData();
        var sgdt_idx = $('#sgdt_idx').val();

        form_data.append("act", "my_location_search");
        form_data.append("mt_idx", mt_idx);

        $.ajax({
            url: "./schedule_update",
            enctype: "multipart/form-data",
            data: form_data,
            type: "POST",
            async: true,
            contentType: false,
            processData: false,
            cache: true,
            timeout: 5000,
            dataType: 'json',
            success: function(data) {
                if (data) {
                    var lat = parseFloat(data.mlt_lat); // 숫자로 변환
                    var lng = parseFloat(data.mlt_long); // 숫자로 변환
                    console.log('f_my_location_btn lat : ' + lat + ' lng : ' + lng);

                    currentLat = lat;
                    currentLng = lng;
                    if (previousTransformY === 'translateY(0px)') {
                        panMapDown();
                        console.log('panMapDown');
                    } else {
                        console.log('panMapUp');
                        panMapUp();
                    }

                    // pedestrian_path_check 호출 제거
                } else {
                    console.log('Error: No data received from server');
                }
            },
            error: function(err) {
                console.log('Error:', err);
            },
        });

        // console.timeEnd("forEachLoopExecutionTime");
    }

    function checkAdCount() {
        var ad_data = fetchAdDisplayStatus();
        console.log('index.php - ad_alert : ' + ad_data.ad_alert + ' ad_show : ' + ad_data.ad_show + ' ad_count : ' + ad_data.ad_count);

        try {
            if (ad_data.ad_show == 'Y') {
                requestAdDisplay(ad_data)
                    .then(() => {
                        console.log("Ad shown successfully");
                    })
                    .catch((error) => {
                        console.error("Error in requestAdDisplay:", error);
                    })
                    .finally(() => {
                        updateAdDisplayCount(ad_data);
                        gtag('event', 'index_ad', {
                            'event_category': 'show_log',
                            'event_label': 'show',
                            'user_id': '<?= $_SESSION['_mt_idx'] ?>',
                            'platform': isAndroidDevice() ? 'Android' : (isiOSDevice() ? 'iOS' : 'Unknown')
                        });
                        // setTimeout(() => {
                        //     updateMemberLocationInfo();
                        // }, 1000); // 광고 표시 시도 후 1초 뒤에 지도 로드
                    });
            } else {
                updateAdDisplayCount(ad_data);
            }
        } catch (err) {
            console.log("Error in checkAdCount: " + err);
            updateAdDisplayCount(ad_data);
        }
    }

    function fetchAdDisplayStatus() {
        <?php
        unset($arr_data);
        $arr_data = array(
            "ad_alert" => "N",
            "ad_show" => "N",
            "ad_count" => "0"
        );

        $DB->where('mt_idx', $_SESSION['_mt_idx']);
        $mem_row = $DB->getone('member_t');

        // 무료회원인지 확인하고 광고체크하기
        if (((
                $mem_row['mt_level'] == '2'
                // && ($_SESSION['_mt_idx'] == 286 || $_SESSION['_mt_idx'] == 275 || $_SESSION['_mt_idx'] == 281 )
            )
                || $_SESSION['_mt_idx'] == 281)  //시리
            && ($_SESSION['_mt_idx'] != 272) //지니
        ) {
            // 무료회원일 경우 광고 카운트 확인하기
            $ad_row = get_ad_log_check($_SESSION['_mt_idx']);
            $ad_count = $ad_row['path_count']; // 현재 광고 수
            $ad_check = $ad_count % 5;

            if ($ad_check == 1) { // 클릭이 5번째일 때
                $arr_data['ad_alert'] = 'Y';
                $arr_data['ad_show'] = 'Y';
            } else {
                $arr_data['ad_alert'] = 'N';
                $arr_data['ad_show'] = 'N';
            }

            $arr_data['ad_count'] = $ad_count;
        }

        $ad_data = json_encode($arr_data);
        ?>
        // console.log(<?= $_SESSION['_mt_idx'] ?>);
        // console.log(<?= $mem_row['mt_level'] ?>);
        // console.log("ad_count :  <?= $ad_count ?>");
        // console.log(<?= $ad_data ?>);
        return <?= $ad_data ?>;
    }

    function requestAdDisplay(data) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    var message = {
                        type: "showAd",
                    };
                    if (!isAndroidDevice() && !isiOSDevice()) {
                        console.log("Showing desktop ad");
                    } else if (isAndroidDevice()) {
                        window.smapAndroid.showAd();
                        console.log("Showing Android ad");
                    } else if (isiOSDevice()) {
                        window.webkit.messageHandlers.smapIos.postMessage(message);
                        console.log("Showing iOS ad");
                    }
                    console.log("Ad display attempted");
                    resolve();
                } catch (error) {
                    console.error("Error showing ad:", error);

                    // 에러 로그를 서버에 저장
                    saveErrorLog(error);

                    reject(error);
                }
            }, 800); // 0.8초 지연 후 광고 표시 시도
        });
    }

    function saveErrorLog(error) {
        var logData = {
            mt_idx: <?= $_SESSION['_mt_idx'] ?>,
            error_message: error.message,
            error_stack: error.stack,
            user_agent: navigator.userAgent,
            platform: isAndroidDevice() ? 'Android' : (isiOSDevice() ? 'iOS' : 'Unknown'),
            timestamp: new Date().toISOString()
        };

        $.ajax({
            url: "./save_ad_error_log.php",
            type: "POST",
            data: JSON.stringify(logData),
            contentType: "application/json",
            success: function(response) {
                console.log("Error log saved successfully:", response);
            },
            error: function(xhr, status, error) {
                console.error("Failed to save error log:", error);
            }
        });
    }

    function updateAdDisplayCount(data) {
        var form_data = new FormData();
        form_data.append("act", "show_ad_path_log");
        // form_data.append("log_count", data.ad_count);
        form_data.append("mt_idx", <?= $_SESSION['_mt_idx'] ?>);

        $.ajax({
            url: "./show_ad_log_update",
            enctype: "multipart/form-data",
            data: form_data,
            type: "POST",
            async: true,
            contentType: false,
            processData: false,
            cache: true,
            timeout: 5000
        });
    }

    // MutationObserver 설정
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.attributeName === 'style') {
                handleMutation(); // 변동 감지 시 실행
            }
        });
    });

    function panMapDown() {
        originalCenter = map.getCenter();
        let newLat = (currentLat || originalCenter.y) - (300 / 111000) * 1.05;
        let newCenter = new naver.maps.LatLng(newLat, currentLng || originalCenter.x);

        map.panTo(newCenter, {
            duration: 700,
            easing: 'easeOutCubic'
        });

        isPannedDown = true;
    }

    function panMapUp() {
        let targetLatLng = currentLat ? new naver.maps.LatLng(currentLat, currentLng) : originalCenter;

        map.panTo(targetLatLng, {
            duration: 700,
            easing: 'easeOutCubic',
            onComplete: function() {
                isPannedDown = false;
                originalCenter = null;
            }
        });
    }

    // 감시 시작
    observer.observe(optBottom, {
        attributes: true,
        attributeFilter: ['style']
    });

    // MutationObserver가 실행할 로직을 별도의 함수로 분리
    function handleMutation() {
        if (optBottom.style.transform !== previousTransformY) {
            previousTransformY = optBottom.style.transform;

            if (previousTransformY === 'translateY(0px)') {
                panMapDown();
            } else if (isPannedDown) {
                panMapUp();
            }
        }
    }

    function isAndroidDevice() {
        if (/Android/i.test(navigator.userAgent) && typeof window.smapAndroid !== 'undefined') {
            console.log('Android!!');
        }
        return /Android/i.test(navigator.userAgent) && typeof window.smapAndroid !== 'undefined';
    }

    function isiOSDevice() {
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos) {
            console.log('iOS!!');
        }
        return /iPhone|iPad|iPod/i.test(navigator.userAgent) && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.smapIos;
    }

    // setInterval(() => {
    //     var sgdt_idx = $('#sgdt_idx').val();
    //     // marker_reload(sgdt_idx);
    //     // console.log(sgdt_idx);
    // }, 30000);
</script>
<?php
include $_SERVER['DOCUMENT_ROOT'] . "/foot.inc.php";
include $_SERVER['DOCUMENT_ROOT'] . "/tail.inc.php";
?>