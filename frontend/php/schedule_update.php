<?php

include $_SERVER['DOCUMENT_ROOT'] . "/lib.inc.php";

if ($_POST['act'] == "event_source") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    if ($_POST['sgdt_mt_idx']) {
        $mt_idx_t = $_POST['sgdt_mt_idx'];
    } else {
        $mt_idx_t = $_SESSION['_mt_idx'];
    }

    $arr_data = array();

    //나의 일정
    unset($list);
    $DB->where('mt_idx', $mt_idx_t);
    $DB->where("( sst_sdate >= '" . $_POST['start'] . " 23:59:59' and sst_edate <= '" . $_POST['end'] . " 00:00:00' )");
    $DB->where('sst_show', 'Y');
    $list = $DB->get('smap_schedule_t');

    if ($list) {
        foreach ($list as $row) {
            if ($row['sst_title']) {
                $cd = cal_remain_days($row['sst_sdate'], $row['sst_edate']);

                if ($cd) {
                    for ($q = 0; $q < $cd; $q++) {
                        $sdate_t = date("Y-m-d", strtotime($row['sst_sdate'] . " +" . $q . " days"));
                        $arr_data[] = array(
                            'id' => $row['sst_idx'],
                            'start' => $sdate_t,
                            'end' => $row['sst_edate'],
                            'title' => $row['sst_title'],
                        );
                    }
                }
            }
        }
    }

    //나에게 온 일정
    $DB->where('mt_idx', $mt_idx_t);
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $row_sgdt = $DB->getone('smap_group_detail_t', 'GROUP_CONCAT(sgt_idx) as gc_sgt_idx');

    if ($row_sgdt['gc_sgt_idx']) {
        unset($list);
        $DB->where("sgt_idx in (" . $row_sgdt['gc_sgt_idx'] . ")");
        $DB->where(" ( sst_sdate >= '" . $_POST['start'] . " 23:59:59' and sst_edate <= '" . $_POST['end'] . " 00:00:00' )");
        $DB->where('sst_show', 'Y');
        $list = $DB->get('smap_schedule_t');

        if ($list) {
            foreach ($list as $row) {
                if ($row['sst_title']) {
                    $cd = cal_remain_days($row['sst_sdate'], $row['sst_edate']);

                    if ($cd) {
                        for ($q = 0; $q < $cd; $q++) {
                            $sdate_t = date("Y-m-d", strtotime($row['sst_sdate'] . " +" . $q . " days"));
                            $arr_data[] = array(
                                'id' => $row['sst_idx'],
                                'start' => $sdate_t,
                                'end' => $row['sst_edate'],
                                'title' => $row['sst_title'],
                            );
                        }
                    }
                }
            }
        }
    }

    $rtn = json_encode($arr_data);

    echo $rtn;
} elseif ($_POST['act'] == "list") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    $mt_idx = $_SESSION['_mt_idx'];
    $event_start_date = $_POST['event_start_date'];

    // 사용자 관련 그룹 정보 가져오기
    $user_groups = $DB->rawQuery("
        SELECT 
            (SELECT COUNT(*) FROM smap_group_t WHERE mt_idx = $mt_idx AND sgt_show = 'Y') as owner_count,
            (SELECT COUNT(*) FROM smap_group_detail_t WHERE mt_idx = $mt_idx AND sgdt_owner_chk = 'N' AND sgdt_leader_chk = 'Y' AND sgdt_show = 'Y' AND sgdt_discharge = 'N' AND sgdt_exit = 'N') as leader_count,
            GROUP_CONCAT(DISTINCT sgt.sgt_idx) as invited_group_ids
        FROM smap_group_detail_t sgdt
        LEFT JOIN smap_group_t sgt ON sgdt.sgt_idx = sgt.sgt_idx
        WHERE sgdt.mt_idx = $mt_idx AND sgdt.sgdt_show = 'Y' AND sgdt.sgdt_discharge = 'N' AND sgdt.sgdt_exit = 'N' AND sgt.sgt_show = 'Y'
    ");

    $user_group_info = $user_groups[0];
    $sgt_cnt = $user_group_info['owner_count'];
    $sgdt_cnt = $user_group_info['leader_count'];

    // 초대된 그룹 정보 가져오기
    $list_sgt = [];
    if (!empty($user_group_info['invited_group_ids'])) {
        $list_sgt = $DB->rawQuery("
            SELECT * FROM smap_group_t
            WHERE sgt_idx IN (" . $user_group_info['invited_group_ids'] . ")
            ORDER BY sgt_idx ASC, sgt_udate DESC
        ");
    }

    $group_data = [];

    if ($list_sgt) {
        foreach ($list_sgt as $row_sgt) {
            // 각 그룹에 대한 그룹원 목록을 가져옵니다.
            $members = $DB->rawQuery("
                SELECT sgdt.*, mem.mt_nickname, mem.mt_file1
                FROM smap_group_detail_t sgdt
                JOIN member_t mem ON sgdt.mt_idx = mem.mt_idx
                WHERE sgdt.sgt_idx = " . $row_sgt['sgt_idx'] . " 
                AND sgdt.sgdt_show = 'Y' 
                AND sgdt.sgdt_discharge = 'N' 
                AND sgdt.sgdt_exit = 'N'
            ");

            $member_data = [];
            $schedule_data = [];

            if ($members) {
                foreach ($members as $member) {
                    // 현재 사용자를 제외하고 그룹원 추가
                    if ($member['mt_idx'] != $_SESSION['_mt_idx']) {
                        $member_data[] = [
                            'sgdt_idx' => $member['sgdt_idx'],
                            'mt_nickname' => $member['mt_nickname'],
                            'mt_file1' => $member['mt_file1']
                        ];

                        // 각 그룹원의 일정 가져오기
                        $schedules = $DB->rawQuery("
                            SELECT * FROM smap_schedule_t
                            WHERE sgdt_idx = " . $member['sgdt_idx'] . " 
                            AND sst_sdate <= '$event_start_date 23:59:59' 
                            AND sst_edate >= '$event_start_date 00:00:00'
                            AND sst_show = 'Y'
                            ORDER BY sst_sdate ASC
                        ");

                        if ($schedules) {
                            foreach ($schedules as $schedule) {
                                $schedule_data[] = $schedule;
                            }
                        }
                    }
                }
            }

            $group_data[] = [
                'group' => $row_sgt,
                'members' => $member_data,
                'schedules' => $schedule_data
            ];
        }
    }

    // JSON 응답 생성
    $response = [
        'event_start_date' => $event_start_date,
        'event_start_date_t' => DateType($event_start_date, 20),
        'user_groups' => $user_group_info,
        'sgt_cnt' => $sgt_cnt,
        'sgdt_cnt' => $sgdt_cnt,
        'group_data' => $group_data,
        'txt_schedule_of' => $translations['txt_schedule_of'],
        'txt_no_data' => $translations['txt_no_data'],
        'mt_idx' => $mt_idx,
        'mt_nickname' => $_SESSION['_mt_nickname'] ? $_SESSION['_mt_nickname'] : $_SESSION['_mt_name'],
        'mt_file1' => $_SESSION['_mt_file1'],
        'ct_no_profile_img_url' => $ct_no_profile_img_url,
        'CDN_HTTP' => CDN_HTTP,
    ];

    echo json_encode($response);
} elseif ($_POST['act'] == "get_schedule_member") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    } ?>
    <ul class="member_group" id="accordionExample">
        <?php
        $DB->where('mt_idx', $_SESSION['_mt_idx']);
        $DB->where('sgdt_discharge', 'N');
        $DB->where('sgdt_exit', 'N');
        $row_sgdt = $DB->getone('smap_group_detail_t', 'GROUP_CONCAT(sgt_idx) as gc_sgt_idx, GROUP_CONCAT(sgdt_idx) as gc_sgdt_idx');

        if ($row_sgdt['gc_sgt_idx']) {
            unset($list_sgt);
            // $DB->where("sgt_idx in (" . $row_sgdt['gc_sgt_idx'] . ")");
            $DB->where("sgdt_idx in (" . $row_sgdt['gc_sgdt_idx'] . ")");
            $DB->where('sgt_show', 'Y');
            $DB->orderBy("sgt_udate", "desc");
            $DB->orderBy("sgt_idx", "asc");
            $list_sgt = $DB->get('smap_group_t');

            if ($list_sgt) {
                foreach ($list_sgt as $row_sgt) {
                    $member_cnt_t = get_group_member_cnt($row_sgt['sgt_idx']);
        ?>
                    <li>
                        <div class="group_name">
                            <h2 class="mb-0">
                                <button type="button" class="btn btn-secondary justify-content-between w-100 btn-md rounded-0 pl_20 pr_25 fw_700 border-0" data-toggle="collapse" data-target="#group_cont_<?= $row_sgt['sgt_idx'] ?>" aria-expanded="false" aria-controls="group_cont_<?= $row_sgt['sgt_idx'] ?>"><?= $row_sgt['sgt_title'] ?> (<?= number_format($member_cnt_t) ?>) <img src="<?= CDN_HTTP ?>/img/arrow_down.png"></button>
                            </h2>
                        </div>

                        <div id="group_cont_<?= $row_sgt['sgt_idx'] ?>" class="group_cont collapse">
                            <div class="card-body">
                                <ul class="member_lst">
                                    <?php
                                    unset($list_sgdt);
                                    $list_sgdt = get_sgdt_member_list($row_sgt['sgt_idx']);

                                    if ($list_sgdt['data']) {
                                        foreach ($list_sgdt['data'] as $key => $val) {
                                            if ($_SESSION['_mt_idx'] == $val['mt_idx']) {
                                                $val['mt_nickname'] = '나';
                                            }
                                    ?>
                                            <li>
                                                <div class="d-flex align-items-center">
                                                    <div class="checks m-0">
                                                        <label for="sgdt_idx_r1_<?= $val['sgdt_idx'] ?>">
                                                            <input type="radio" class="sgdt_idx_c" name="sgdt_idx_r1" id="sgdt_idx_r1_<?= $val['sgdt_idx'] ?>" value="<?= $val['sgdt_idx'] ?>" <?php if ($_POST['sgdt_idx'] == $val['sgdt_idx']) {
                                                                                                                                                                                                    echo " checked";
                                                                                                                                                                                                } ?> />
                                                            <span class="ic_box"><i class="xi-check-min"></i></span>
                                                        </label>
                                                        <input type="hidden" name="mt_nickname_r1_<?= $val['sgdt_idx'] ?>" id="mt_nickname_r1_<?= $val['sgdt_idx'] ?>" value="<?= $val['mt_nickname'] ?>" />
                                                        <input type="hidden" name="mt_idx_r1_<?= $val['sgdt_idx'] ?>" id="mt_idx_r1_<?= $val['sgdt_idx'] ?>" value="<?= $val['mt_idx'] ?>" />
                                                    </div>
                                                    <div class="prd_img flex-shrink-0 mr_12">
                                                        <div class="rect_square rounded_14">
                                                            <img src="<?= $val['mt_file1_url'] ?>" onerror="this.src='<?= $ct_no_profile_img_url ?>'" alt="이미지" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p class="fs_14 fw_500 text_dynamic line_h1_2 mr-2" style="word-break: break-all;"><?= $val['mt_nickname'] ?></p>
                                                        <div class="d-flex align-items-center flex-wrap">
                                                            <p class="fs_12 fw_400 text_dynamic text-primary line_h1_2 mt-1" style="word-break: break-all;"><?= $translations['txt_' . $val['sgdt_owner_leader_chk_t']] ?></p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                    <?php
                                        }
                                    }
                                    ?>
                                </ul>
                            </div>
                        </div>
                    </li>
            <?php
                }
            }
        } else {
            ?>
            <li>
                <div class="pt-5 text-center">
                    <img src="<?= CDN_HTTP ?>/img/warring.png" width="82px" alt="자료없음">
                    <p class="mt_20 fc_gray_900 text-center"><?= $translations['txt_no_members_registered'] ?></p>
                </div>
                <!-- 멤버가 없을때 -->
            </li>
        <?php
        }
        ?>
    </ul>
<? } elseif ($_POST['act'] == "get_schedule_map") { ?>
    <form method="post" name="frm_schedule_map" id="frm_schedule_map">
        <div class="modal-header">
            <p class="modal-title line1_text fs_20 fw_700"><?= $translations['txt_select_location'] ?></p>
            <div><button type="button" class="close" data-dismiss="modal" aria-label="Close"><img src="<?= CDN_HTTP ?>/img/modal_close.png"></button></div>
        </div>
        <div class="modal-body scroll_bar_y" style="min-height: 600px;">
            <div class="px-0 py-0 map_wrap">
                <div class="map_wrap_re">
                    <div class="pin_cont bg-white pt_20 px_16 pb_16 rounded_10">
                        <ul>
                            <li class="d-flex">
                                <div class="name flex-fill">
                                    <span class="fs_12 fw_600 text-primary"><?= $translations['txt_selected_location'] ?></span>
                                    <div class="fs_14 fw_600 text_dynamic mt-1 line_h1_3"></div>
                                </div>
                                <button type="button" class="mark_btn on"></button>
                            </li>
                        </ul>
                    </div>
                    <div class="map_ab" id="naver_map">
                        <div class="point point2">
                            <img src="<?= CDN_HTTP ?>/img/pin_marker.png" width="39px" alt="이미지">
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-footer border-0 p-0">
            <button type="submit" class="btn btn-md btn-block btn-primary mx-0 my-0"><?= $translations['txt_select_location_complete'] ?></button>
        </div>
    </form>
    <?php
} elseif ($_POST['act'] == "map_location_input") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $DB->where('slt_add', $_POST['slt_add']);
    $DB->where('slt_show', 'Y');
    $row_slt = $DB->getone('smap_location_t');

    if ($row_slt['slt_idx']) {
        unset($arr_query);
        $arr_query = array(
            "slt_show" => "N",
        );

        $DB->where('slt_idx', $row_slt['slt_idx']);

        $DB->update('smap_location_t', $arr_query);

        $_last_idx = $row_slt['slt_idx'];
    } else {
        unset($arr_query);
        $arr_query = array(
            "mt_idx" => $_SESSION['_mt_idx'],
            "slt_title" => $_POST['slt_title'],
            "slt_add" => $_POST['slt_add'],
            "slt_lat" => $_POST['slt_lat'],
            "slt_long" => $_POST['slt_long'],
            "slt_show" => "Y",
            "slt_wdate" => $DB->now(),
        );

        $_last_idx = $DB->insert('smap_location_t', $arr_query);
    }

    echo $_last_idx;
} elseif ($_POST['act'] == "list_like_location") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $mem_row = $DB->getone('member_t');
    if ($mem_row['mt_level'] == '2') {
        $limit = 2;
    } else {
        $limit = 10;
    }

    unset($list_slt);
    $DB->where('(mt_idx =' . $_POST['mt_idx'] . ' or sgdt_idx = ' . $_POST['sgdt_idx'] . ')');
    $DB->where('slt_show', 'Y');
    $DB->orderby('slt_wdate', 'asc');
    $list_slt = $DB->get('smap_location_t', $limit);

    if ($list_slt) {
        foreach ($list_slt as $row_slt) {
    ?>
            <li class="border bg-white  rounded_10">
                <input type="hidden" name="slt_title" id="slt_title_<?= $row_slt['slt_idx'] ?>" value="<?= $row_slt['slt_title'] ?>" />
                <input type="hidden" name="slt_add" id="slt_add_<?= $row_slt['slt_idx'] ?>" value="<?= $row_slt['slt_add'] ?>" />
                <input type="hidden" name="slt_lat" id="slt_lat_<?= $row_slt['slt_idx'] ?>" value="<?= $row_slt['slt_lat'] ?>" />
                <input type="hidden" name="slt_long" id="slt_long_<?= $row_slt['slt_idx'] ?>" value="<?= $row_slt['slt_long'] ?>" />
                <div class="">
                    <div class="checks m-0">
                        <label class="p-4">
                            <input type="radio" class="slt_idx_c" name="slt_idx_r1" id="slt_idx_r1" value="<?= $row_slt['slt_idx'] ?>" />
                            <span class="ic_box"><i class="xi-check-min"></i></span>
                            <div class="flex-fill">
                                <div class="name">
                                    <span class="fw_700"><?= $row_slt['slt_title'] ?></span>
                                </div>
                                <div class="fs_13 fc_gray_600 text_dynamic mt-1 line_h1_3" style="white-space: pre-line;"><?= $row_slt['slt_add'] ?></div>
                            </div>
                        </label>
                    </div>
                </div>
            </li>
        <?php
        }
    } else {
        ?>
        <li>
            <div class="pt-5 text-center">
                <img src="<?= CDN_HTTP ?>/img/warring.png" width="82px" alt="자료없음">
                <p class="mt_20 fc_gray_500 text-center line_h1_4"><?= $translations['txt_no_registered_locations'] ?></p>
            </div>
            <!-- 멤버가 없을때 -->
        </li>
        <?php
    }
} elseif ($_POST['act'] == "map_location_like_delete") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    if ($_POST['slt_idx'] == '') {
        p_alert('잘못된 접근입니다. slt_idx');
    }

    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $DB->where('slt_idx', $_POST['slt_idx']);
    $row_slt = $DB->getone('smap_location_t');

    if ($row_slt['slt_idx']) {
        unset($arr_query);
        $arr_query = array(
            "slt_show" => "N",
        );

        $DB->where('slt_idx', $row_slt['slt_idx']);

        $DB->update('smap_location_t', $arr_query);

        echo "Y";
    } else {
        echo "N";
    }
} elseif ($_POST['act'] == "list_contact") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    unset($list_sctg);
    if ($_POST['sst_idx']) {
        $DB->where('sst_idx', $_POST['sst_idx']);
    } else {
        $DB->where("sst_idx is null");
    }
    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $DB->groupBy("sct_category");
    $DB->orderBy("sct_idx", "desc");
    $list_sctg = $DB->get('smap_contact_t');

    if ($list_sctg) {
        foreach ($list_sctg as $row_sctg) {
        ?>
            <!-- <li data-toggle="modal" data-target="#contact_modify">
            <div class="text-primary mb-3"><?= $row_sctg['sct_category'] ?></div> -->
            <li>
                <!-- <div class="text-primary mb-3"><?= $row_sctg['sct_category'] ?></div> -->
                <ul class="contact_list" id="contact_list_li">
                    <?php
                    unset($list_sct);
                    if ($_POST['sst_idx']) {
                        $DB->where('sst_idx', $_POST['sst_idx']);
                    } else {
                        $DB->where("sst_idx is null");
                    }
                    $DB->where('mt_idx', $_SESSION['_mt_idx']);
                    $DB->where('sct_category', $row_sctg['sct_category']);
                    $DB->orderBy("sct_idx", "desc");
                    $list_sct = $DB->get('smap_contact_t');

                    if ($list_sct) {
                        foreach ($list_sct as $row_sct) {
                    ?>
                            <!-- <li class="d-flex justify-content-between">
                                <div><?= $row_sct['sct_title'] ?></div>
                                <div class="fc_gray_500"><?= $row_sct['sct_hp'] ?></div>
                                <input type="hidden" name="sst_idx" id="sst_idx<?= $row_sct['sst_idx'] ?>" value="<?= $row_sct['sst_idx'] ?>" />
                            </li> -->
                            <li class="d-flex justify-content-between">
                                <div class="pr-3"><?= $row_sct['sct_title'] ?></div>
                                <a href="tel:<?= $row_sct['sct_hp'] ?>" class="fc_gray_500"><?= $row_sct['sct_hp'] ?></a>
                                <input type="hidden" name="sst_idx" id="sst_idx<?= $row_sct['sst_idx'] ?>" value="<?= $row_sct['sst_idx'] ?>" />
                            </li>
                    <?php
                        }
                    }
                    ?>
                </ul>
            </li>
        <?php
        }
    } else {
        ?>
        <!-- <li>
            <button type="button" class="border bg-white px_12 py-4 rounded_16 align-items-center d-flex flex-column justify-content-center w-100" data-toggle="modal" data-target="#schedule_contact">
                <img class="d-block" src="<?= CDN_HTTP ?>/img/ico_add.png" style="width:2.0rem;">
                <span class="fc_gray_500 fw_700 mt-3">새로운 연락처추가</span>
            </button>
        </li> -->
    <?php
    }
} elseif ($_POST['act'] == "contact_input") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    if ($_POST['sst_idx']) {
        unset($arr_query);
        $arr_query = array(
            "mt_idx" => $_SESSION['_mt_idx'],
            "sst_idx" => $_POST['sst_idx'],
            "sct_category" => $_POST['sct_category'],
            "sct_title" => $_POST['sct_title'],
            "sct_hp" => $_POST['sct_hp'],
            "sct_wdate" => $DB->now(),
        );
        $_last_idx = $DB->insert('smap_contact_t', $arr_query);
    } else {
        $DB->where('mt_idx', $_SESSION['_mt_idx']);
        $DB->where('sct_category', $_POST['sct_category']);
        $DB->where('sct_title', $_POST['sct_title']);
        $DB->where('sct_hp', $_POST['sct_hp']);
        $row_slt = $DB->getone('smap_contact_t');

        if ($row_slt['slt_idx'] == '') {
            unset($arr_query);
            $arr_query = array(
                "mt_idx" => $_SESSION['_mt_idx'],
                "sct_category" => $_POST['sct_category'],
                "sct_title" => $_POST['sct_title'],
                "sct_hp" => $_POST['sct_hp'],
                "sct_wdate" => $DB->now(),
            );

            $_last_idx = $DB->insert('smap_contact_t', $arr_query);
        }
    }

    echo "Y";
} elseif ($_POST['act'] == "schedule_form") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    if ($_POST['sst_title'] == '') {
        p_alert('잘못된 접근입니다. sst_title');
    }
    if ($_POST['sst_sdate'] == '') {
        p_alert('잘못된 접근입니다. sst_sdate');
    }
    // if ($_POST['sgdt_idx_t'] == '') {
    //     p_alert('잘못된 접근입니다. sgdt_idx_t');
    // }
    // if ($_POST['slt_idx_t'] == '') {
    //     p_alert('잘못된 접근입니다. slt_idx_t');
    // }

    if ($_POST['sgdt_idx']) {
        $DB->where('sgdt_idx', $_POST['sgdt_idx']);
        $row_sgdt = $DB->getone('smap_group_detail_t');
    }

    if ($_POST['sst_all_day'] != 'Y') {
        $_POST['sst_all_day'] = 'N';
    }
    if ($_POST['sst_schedule_alarm_chk'] != 'Y') {
        $_POST['sst_schedule_alarm_chk'] = 'N';
    }
    // JSON을 배열로 변환
    $repeat_array = json_decode($_POST['sst_repeat_json'], true);
    // 반복을 저장할 배열
    $repeat_values = array();

    // "r1"이 1이 아니거나 값이 없는 경우를 제외하고 반복을 생성
    if ($repeat_array['r1'] == 1 || empty($repeat_array['r1'])) {
        // $repeat_sdate = $_POST['pick_sdate'];
        // $repeat_edate = $_POST['pick_edate'];

        // // 시작 날짜와 종료 날짜를 DateTime 객체로 변환
        // $start_date = new DateTime($repeat_sdate);
        // $end_date = new DateTime($repeat_edate);

        // // 날짜 사이의 모든 날짜를 구하기 위한 DatePeriod 생성
        // $date_period = new DatePeriod($start_date, new DateInterval('P1D'), $end_date->modify('+1 day'));

        // // 모든 날짜를 저장할 배열
        // $all_dates = array();

        // // DatePeriod에서 각 날짜를 반복하여 배열에 추가
        // foreach ($date_period as $date) {
        //     $all_dates[] = $date->format('Y-m-d');
        // }
    } else {
        // 시작 날짜와 종료 날짜
        $repeat_sdate = $_POST['pick_sdate'];
        // $repeat_edate = $_POST['pick_edate'];
        // $repeat_edate = '2049-12-31'; // repeat_edate를 2099년 12월 31일로 설정 ->2049년 12월 31일로 설정 
        $timestamp = strtotime($repeat_sdate);
        $repeat_edate = date('Y-m-d', strtotime('+3 years', $timestamp)); // 10년 뒤의 날짜 계산

        // 시작 날짜와 종료 날짜를 DateTime 객체로 변환
        $start_date = new DateTime($repeat_sdate);
        $end_date = new DateTime($repeat_edate);

        if ($repeat_array['r1'] == 3) { // 매 반복일 시 요일 찾은 후 반복 실행
            if (isset($repeat_array['r2']) && !empty($repeat_array['r2'])) {
                // "r2" 값을 쉼표로 분리하여 배열로 변환
                $r2_values = explode(',', $repeat_array['r2']);
                // 배열에 추가
                foreach ($r2_values as $value) {
                    if (!empty($value)) {
                        $repeat_values[] = $value;
                    }
                }
                // "r2" 값에 해당하는 요일에 대해 날짜를 구하고 저장할 배열
                $all_dates = array();

                // DatePeriod에서 각 날짜를 반복하여 배열에 추가
                foreach ($repeat_values as $day_of_week) {
                    $current_date = clone $start_date;
                    // 해당 요일의 날짜를 찾아 배열에 추가
                    while ($current_date <= $end_date) {
                        if ($current_date->format('N') == $day_of_week) {
                            $all_dates[] = $current_date->format('Y-m-d');
                        }
                        $current_date->modify('+1 day');
                    }
                }
            }
        } else if ($repeat_array['r1'] == 2) { // 매일 반복
            // 시작 날짜와 종료 날짜를 DateTime 객체로 변환
            $start_date = new DateTime($repeat_sdate);
            $end_date = new DateTime($repeat_edate);

            // 날짜 사이의 모든 날짜를 구하기 위한 DatePeriod 생성
            $date_period = new DatePeriod($start_date, new DateInterval('P1D'), $end_date);

            // 모든 날짜를 저장할 배열
            $all_dates = array();

            // DatePeriod에서 각 날짜를 반복하여 배열에 추가
            foreach ($date_period as $date) {
                $all_dates[] = $date->format('Y-m-d');
            }
        } else if ($repeat_array['r1'] == 4) { // 매월 반복
            // 시작 날짜와 종료 날짜를 DateTime 객체로 변환
            $start_date = new DateTime($repeat_sdate);
            $end_date = new DateTime($repeat_edate);

            // 날짜 사이의 모든 날짜를 구하기 위한 DatePeriod 생성
            $date_period = new DatePeriod($start_date, new DateInterval('P1M'), $end_date);

            // 모든 날짜를 저장할 배열
            $all_dates = array();

            // DatePeriod에서 각 날짜를 반복하여 배열에 추가
            foreach ($date_period as $date) {
                $all_dates[] = $date->format('Y-m-d');
            }
        } else if ($repeat_array['r1'] == 5) { // 매년 반복
            // 시작 날짜와 종료 날짜를 DateTime 객체로 변환
            $start_date = new DateTime($repeat_sdate);
            $end_date = new DateTime($repeat_edate);

            // 날짜 사이의 모든 날짜를 구하기 위한 DatePeriod 생성
            $date_period = new DatePeriod($start_date, new DateInterval('P1Y'), $end_date);

            // 모든 날짜를 저장할 배열
            $all_dates = array();

            // DatePeriod에서 각 날짜를 반복하여 배열에 추가
            foreach ($date_period as $date) {
                $all_dates[] = $date->format('Y-m-d');
            }
        }
    }
    if ($_POST['sst_idx']) {
        // 업데이트
        if ($_POST['sst_pidx']) {
            // 반복 일정일 경우 삭제 후 다시 추가입력
            $DB->where('sst_pidx', $_POST['sst_pidx']);
            $DB->delete('smap_schedule_t');

            $DB->where('sst_idx', $_POST['sst_pidx']);
            $DB->delete('smap_schedule_t');

            foreach ($all_dates as $date) {
                $sst_schedule_alarm = '';
                $sst_sdate = $date . ' ' . $_POST['pick_stime'];
                $sst_edate = $date . ' ' . $_POST['pick_etime'];
                // 일정알림시간 구하기
                if ($_POST['sst_all_day'] == 'N') {
                    if ($_POST['sst_schedule_alarm_chk'] == 'Y') {
                        // sst_pick_result 값이 시간(minute) 단위로 전송되므로, 이 값을 정수형으로 변환하여 사용합니다.
                        $sst_pick_result = intval($_POST['sst_pick_result']);
                        // sst_sdate 값을 DateTime 객체로 변환합니다.
                        $sst_sdatetime = new DateTime($sst_sdate);
                        if (
                            $_POST['sst_pick_type'] == 'minute'
                        ) {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result minute")->format('Y-m-d H:i:s');
                        } else if ($_POST['sst_pick_type'] == 'hour') {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result hour")->format('Y-m-d H:i:s');
                        } else if ($_POST['sst_pick_type'] == 'day') {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result day")->format('Y-m-d H:i:s');
                        }
                    }
                }

                unset($arr_query);
                $arr_query = array(
                    "mt_idx" => $_SESSION['_mt_idx'],
                    "sst_title" => $_POST['sst_title'],
                    "sst_sdate" => $sst_sdate,
                    "sst_edate" => $sst_edate,
                    "sst_all_day" => $_POST['sst_all_day'],
                    "sst_repeat_json" => $_POST['sst_repeat_json'],
                    "sst_repeat_json_v" => $_POST['sst_repeat_json_v'],
                    "sgt_idx" => $row_sgdt['sgt_idx'],
                    "sgdt_idx" => $_POST['sgdt_idx'],
                    "sgdt_idx_t" => $_POST['sgdt_idx_t'],
                    "sst_alram" => $_POST['sst_alram'],
                    "sst_alram_t" => $_POST['sst_alram_t'],
                    "slt_idx" => $_POST['slt_idx'],
                    "slt_idx_t" => $_POST['slt_idx_t'],
                    "sst_location_title" => $_POST['sst_location_title'],
                    "sst_location_add" => $_POST['sst_location_add'],
                    "sst_location_lat" => $_POST['sst_location_lat'],
                    "sst_location_long" => $_POST['sst_location_long'],
                    "sst_supplies" => $_POST['sst_supplies'],
                    "sst_memo" => $_POST['sst_memo'],
                    "sst_show" => "Y",
                    "sst_wdate" => $DB->now(),
                    "sst_adate" => $_POST['sst_adate'],
                    "sst_location_alarm" => $_POST['sst_location_alarm'],
                    "sst_schedule_alarm_chk" => $_POST['sst_schedule_alarm_chk'],
                    "sst_pick_type" => $_POST['sst_pick_type'],
                    "sst_pick_result" => $_POST['sst_pick_result'],
                    "sst_schedule_alarm" => $sst_schedule_alarm,
                    "sst_update_chk" => $_POST['sst_update_chk'],
                    "sst_sedate" => $_POST['sst_sdate'] . ' ~ ' . $_POST['sst_edate'],
                );
                if ($_last_idx) {
                    $arr_query['sst_pidx'] = $_last_idx;
                    $DB->insert('smap_schedule_t', $arr_query);
                } else {
                    $_last_idx = $DB->insert('smap_schedule_t', $arr_query);
                }
            }
            //연락처 테이블 업데이트
            if ($_last_idx) {
                unset($arr_query);
                $arr_query = array(
                    "sst_idx" => $_last_idx,
                );
                $DB->where('sst_idx', $_POST['sst_pidx']);
                $DB->update('smap_contact_t', $arr_query);
            }
        } else {
            // 반복 일정일 경우 삭제 후 다시 추가입력
            $DB->where('sst_pidx', $_POST['sst_idx']);
            $sst_plist = $DB->get('smap_schedule_t');

            // 반복 일정 수정 옵션 처리
            if ($_POST['sst_repeat_json'] && $_POST['sst_repeat_json_v'] && $_POST['sst_repeat_json_v'] != '[]') {
                // 반복 일정 수정 옵션 처리
                if (isset($_POST['edit_option']) && $_POST['edit_option'] != 'this' && $_POST['sst_idx']) {
                    // 반복 일정 정보 가져오기
                    $DB->where('sst_idx', $_POST['sst_idx']);
                    $sst_row = $DB->getone('smap_schedule_t');
                    
                    if ($sst_row) {
                        $current_date = date('Y-m-d', strtotime($sst_row['sst_sdate']));
                        
                        if ($_POST['edit_option'] == 'all') {
                            // 모든 반복 일정 수정 - 기존 로직대로 모두 삭제 후 다시 생성
                            $DB->where('sst_pidx', $_POST['sst_idx']);
                            $DB->delete('smap_schedule_t');

                            $DB->where('sst_idx', $_POST['sst_idx']);
                            $DB->delete('smap_schedule_t');
                        } else if ($_POST['edit_option'] == 'future') {
                            // 현재 및 이후 일정만 수정
                            // 현재 일정 이전의 반복 일정은 유지
                            $DB->where('sst_pidx', $_POST['sst_idx']);
                            $DB->where("DATE(sst_sdate) >= ?", [$current_date]);
                            $DB->delete('smap_schedule_t');
                            
                            // 부모 일정도 삭제
                            $DB->where('sst_idx', $_POST['sst_idx']);
                            $DB->delete('smap_schedule_t');
                        }
                    }
                } else if ($_POST['sst_idx']) {
                    // 단일 일정만 수정 - 해당 일정만 삭제하고 새로 생성
                    $DB->where('sst_idx', $_POST['sst_idx']);
                    $sst_row = $DB->getone('smap_schedule_t');
                    
                    if ($sst_row) {
                        // 현재 일정의 날짜 정보 저장
                        $current_date = date('Y-m-d', strtotime($sst_row['sst_sdate']));
                        
                        // 해당 일정만 삭제
                        $DB->where('sst_idx', $_POST['sst_idx']);
                        $DB->delete('smap_schedule_t');
                        
                        // 반복 일정 중 해당 날짜의 일정만 삭제
                        if ($sst_row['sst_pidx']) {
                            // 자식 일정인 경우
                            $DB->where('sst_pidx', $sst_row['sst_pidx']);
                            $DB->where("DATE(sst_sdate) = ?", [$current_date]);
                            $DB->delete('smap_schedule_t');
                        } else {
                            // 부모 일정인 경우
                            $DB->where('sst_pidx', $_POST['sst_idx']);
                            $DB->where("DATE(sst_sdate) = ?", [$current_date]);
                            $DB->delete('smap_schedule_t');
                        }
                        
                        // 이 일정만 수정하는 경우, 해당 날짜만 포함하도록 all_dates 배열 수정
                        $all_dates = array($current_date);
                    }
                }
            } else {
                // 단일 일정만 수정 - 해당 일정만 삭제하고 새로 생성
                $DB->where('sst_idx', $_POST['sst_idx']);
                $sst_row = $DB->getone('smap_schedule_t');
                
                if ($sst_row) {
                    // 현재 일정의 날짜 정보 저장
                    $current_date = date('Y-m-d', strtotime($sst_row['sst_sdate']));
                    
                    // 해당 일정만 삭제
                    $DB->where('sst_idx', $_POST['sst_idx']);
                    $DB->delete('smap_schedule_t');
                    
                    // 반복 일정 중 해당 날짜의 일정만 삭제
                    if ($sst_row['sst_pidx']) {
                        // 자식 일정인 경우
                        $DB->where('sst_pidx', $sst_row['sst_pidx']);
                        $DB->where("DATE(sst_sdate) = ?", [$current_date]);
                        $DB->delete('smap_schedule_t');
                    } else {
                        // 부모 일정인 경우
                        $DB->where('sst_pidx', $_POST['sst_idx']);
                        $DB->where("DATE(sst_sdate) = ?", [$current_date]);
                        $DB->delete('smap_schedule_t');
                    }
                    
                    // 이 일정만 수정하는 경우, 해당 날짜만 포함하도록 all_dates 배열 수정
                    $all_dates = array($current_date);
                }
            }
            
            foreach ($all_dates as $date) {
                $sst_schedule_alarm = '';
                $sst_sdate = $date . ' ' . $_POST['pick_stime'];
                $sst_edate = $date . ' ' . $_POST['pick_etime'];
                // 일정알림시간 구하기
                if ($_POST['sst_all_day'] == 'N') {
                    if ($_POST['sst_schedule_alarm_chk'] == 'Y') {
                        // sst_pick_result 값이 시간(minute) 단위로 전송되므로, 이 값을 정수형으로 변환하여 사용합니다.
                        $sst_pick_result = intval($_POST['sst_pick_result']);
                        // sst_sdate 값을 DateTime 객체로 변환합니다.
                        $sst_sdatetime = new DateTime($sst_sdate);
                        if ($_POST['sst_pick_type'] == 'minute') {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result minute")->format('Y-m-d H:i:s');
                        } else if ($_POST['sst_pick_type'] == 'hour') {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result hour")->format('Y-m-d H:i:s');
                        } else if ($_POST['sst_pick_type'] == 'day') {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result day")->format('Y-m-d H:i:s');
                        }
                    }
                }

                unset($arr_query);
                $arr_query = array(
                    "mt_idx" => $_SESSION['_mt_idx'],
                    "sst_title" => $_POST['sst_title'],
                    "sst_sdate" => $sst_sdate,
                    "sst_edate" => $sst_edate,
                    "sst_all_day" => $_POST['sst_all_day'],
                    "sst_repeat_json" => $_POST['sst_repeat_json'],
                    "sst_repeat_json_v" => $_POST['sst_repeat_json_v'],
                    "sgt_idx" => $row_sgdt['sgt_idx'],
                    "sgdt_idx" => $_POST['sgdt_idx'],
                    "sgdt_idx_t" => $_POST['sgdt_idx_t'],
                    "sst_alram" => $_POST['sst_alram'],
                    "sst_alram_t" => $_POST['sst_alram_t'],
                    "slt_idx" => $_POST['slt_idx'],
                    "slt_idx_t" => $_POST['slt_idx_t'],
                    "sst_location_title" => $_POST['sst_location_title'],
                    "sst_location_add" => $_POST['sst_location_add'],
                    "sst_location_lat" => $_POST['sst_location_lat'],
                    "sst_location_long" => $_POST['sst_location_long'],
                    "sst_supplies" => $_POST['sst_supplies'],
                    "sst_memo" => $_POST['sst_memo'],
                    "sst_show" => "Y",
                    "sst_wdate" => $DB->now(),
                    "sst_adate" => $_POST['sst_adate'],
                    "sst_location_alarm" => $_POST['sst_location_alarm'],
                    "sst_schedule_alarm_chk" => $_POST['sst_schedule_alarm_chk'],
                    "sst_pick_type" => $_POST['sst_pick_type'],
                    "sst_pick_result" => $_POST['sst_pick_result'],
                    "sst_schedule_alarm" => $sst_schedule_alarm,
                    "sst_update_chk" => $_POST['sst_update_chk'],
                    "sst_sedate" => $_POST['sst_sdate'] . ' ~ ' . $_POST['sst_edate'],
                );
                if ($_last_idx) {
                    $arr_query['sst_pidx'] = $_last_idx;
                    $DB->insert('smap_schedule_t', $arr_query);
                } else {
                    $_last_idx = $DB->insert('smap_schedule_t', $arr_query);
                }
            }
        }
        //일정 확인하여 오너가 수정한지 본인이 수정한지 확인
        $DB->where('sst_idx', $_last_idx);
        $sst_row = $DB->getone('smap_schedule_t');

        $DB->where('sgdt_idx', $sst_row['sgdt_idx']);
        $sgdt_row = $DB->getone('smap_group_detail_t');

        if ($_SESSION['_mt_idx'] == $sgdt_row['mt_idx']) { //해당 일정이 본인 일정일 경우
            if ($sgdt_row['sgdt_owner_chk'] == 'Y' || $sgdt_row['sgdt_leader_chk'] == 'Y') { // 본인이 오너 or 리더일 경우
            } else { // 본인이 그룹원일 경우
                // 해당 그룹의 오너/리더 구하기
                $mem_row = get_member_t_info($sgdt_row['mt_idx']); // 그룹원 회원 정보
                $DB->where('sgt_idx', $sst_row['sgt_idx']);
                $DB->where('(sgdt_owner_chk ="Y" or sgdt_leader_chk="Y") and sgdt_exit = "N"');
                $sgdt_list = $DB->get('smap_group_detail_t');
                if ($sgdt_list) {
                    foreach ($sgdt_list as $sgdt_row_ol) {
                        unset($member_row);
                        $member_row = get_member_t_info($sgdt_row_ol['mt_idx']); // 오너/리더 회원정보
                        $plt_type = '2';
                        $sst_idx = $_last_idx;
                        $plt_condition = '그룹원이 자신의 일정 수정';
                        $plt_memo = '해당 그룹의 그룹오너/리더에게 일정이 수정되었다는 푸시알림';
                        // $mt_id = $member_row['mt_idx'];
                        $mt_id = $member_row['mt_id'] ? $member_row['mt_id'] : $member_row['mt_email'];
                        $member_nickname = $member_row['mt_nickname'] ? $member_row['mt_nickname'] : $member_row['mt_name'];
                        $mem_nickname = $mem_row['mt_nickname'] ? $mem_row['mt_nickname'] : $mem_row['mt_name'];
                        $translations_schedule = require $_SERVER['DOCUMENT_ROOT'] . '/lang/' . $member_row['mt_lang'] . '.php';
                        $plt_title =  $translations_schedule['txt_schedule_updated']; //일정 수정알림 ✏️
                        $plt_content = $translations_schedule['txt_schedule_updated_content'];
                        $plt_content = str_replace('{nick_name}', $mem_nickname, $plt_content);
                        $plt_content = str_replace('{sst_title}', $sst_row['sst_title'], $plt_content);

                        $result = api_push_send($plt_type, $sst_idx, $plt_condition, $plt_memo, $mt_id, $plt_title, $plt_content);
                    }
                }
            }
        } else { // 해당 일정이 본인 일정이 아닐 경우
            // 해당 되는 사람에게 일정알림 보내기
            $owner_row = get_member_t_info($_SESSION['_mt_idx']); // 오너/리더 회원 정보
            $member_row = get_member_t_info($sgdt_row['mt_idx']); // 그룹원 회원 정보
            $plt_type = '2';
            $sst_idx = $_last_idx;
            $plt_condition = '그룹오너가 그룹원 일정 수정';
            $plt_memo = '해당 그룹원에게 일정이 수정되었다는 푸시알림';
            // $mt_id = $member_row['mt_idx'];
            $mt_id = $member_row['mt_id'] ? $member_row['mt_id'] : $member_row['mt_email'];
            $member_nickname = $member_row['mt_nickname'] ? $member_row['mt_nickname'] : $member_row['mt_name'];
            $owner_nickname = $owner_row['mt_nickname'] ? $owner_row['mt_nickname'] : $owner_row['mt_name'];
            $translations_schedule = require $_SERVER['DOCUMENT_ROOT'] . '/lang/' . $member_row['mt_lang'] . '.php';
            $plt_title = $translations_schedule['txt_schedule_updated']; //일정 수정알림 ✏️
            $plt_content = $translations_schedule['txt_schedule_updated_content_member'];
            $plt_content = str_replace('{nick_name}', $owner_nickname, $plt_content);
            $plt_content = str_replace('{sst_title}', $sst_row['sst_title'], $plt_content);

            $result = api_push_send($plt_type, $sst_idx, $plt_condition, $plt_memo, $mt_id, $plt_title, $plt_content);
        }
    } else {
        // 처음 등록
        if ($repeat_array['r1'] == 1 || empty($repeat_array['r1'])) {
            // 일정알림시간 구하기
            if ($_POST['sst_all_day'] == 'N') {
                if ($_POST['sst_schedule_alarm_chk'] == 'Y') {
                    // sst_pick_result 값이 시간(minute) 단위로 전송되므로, 이 값을 정수형으로 변환하여 사용합니다.
                    $sst_pick_result = intval($_POST['sst_pick_result']);
                    // sst_sdate 값을 DateTime 객체로 변환합니다.
                    $sst_sdatetime = new DateTime($_POST['sst_sdate']);
                    if ($_POST['sst_pick_type'] == 'minute') {
                        // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                        $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result minute")->format('Y-m-d H:i:s');
                    } else if ($_POST['sst_pick_type'] == 'hour') {
                        // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                        $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result hour")->format('Y-m-d H:i:s');
                    } else if ($_POST['sst_pick_type'] == 'day') {
                        // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                        $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result day")->format('Y-m-d H:i:s');
                    }
                }
            }

            unset($arr_query);
            $arr_query = array(
                "mt_idx" => $_SESSION['_mt_idx'],
                "sst_title" => $_POST['sst_title'],
                "sst_sdate" =>  $_POST['sst_sdate'],
                "sst_edate" =>  $_POST['sst_edate'],
                "sst_all_day" => $_POST['sst_all_day'],
                "sst_repeat_json" => $_POST['sst_repeat_json'],
                "sst_repeat_json_v" => $_POST['sst_repeat_json_v'],
                "sgt_idx" => $row_sgdt['sgt_idx'],
                "sgdt_idx" => $_POST['sgdt_idx'],
                "sgdt_idx_t" => $_POST['sgdt_idx_t'],
                "sst_alram" => $_POST['sst_alram'],
                "sst_alram_t" => $_POST['sst_alram_t'],
                "slt_idx" => $_POST['slt_idx'],
                "slt_idx_t" => $_POST['slt_idx_t'],
                "sst_location_title" => $_POST['sst_location_title'],
                "sst_location_add" => $_POST['sst_location_add'],
                "sst_location_lat" => $_POST['sst_location_lat'],
                "sst_location_long" => $_POST['sst_location_long'],
                "sst_supplies" => $_POST['sst_supplies'],
                "sst_memo" => $_POST['sst_memo'],
                "sst_show" => "Y",
                "sst_wdate" => $DB->now(),
                "sst_adate" => $_POST['sst_adate'],
                "sst_location_alarm" => $_POST['sst_location_alarm'],
                "sst_schedule_alarm_chk" => $_POST['sst_schedule_alarm_chk'],
                "sst_pick_type" => $_POST['sst_pick_type'],
                "sst_pick_result" => $_POST['sst_pick_result'],
                "sst_schedule_alarm" => $sst_schedule_alarm,
                "sst_update_chk" => $_POST['sst_update_chk'],
                "sst_sedate" => $_POST['sst_sdate'] . ' ~ ' . $_POST['sst_edate'],
            );

            $_last_idx = $DB->insert('smap_schedule_t', $arr_query);
        } else {
            foreach ($all_dates as $date) {
                $sst_schedule_alarm = '';
                $sst_sdate = $date . ' ' . $_POST['pick_stime'];
                $sst_edate = $date . ' ' . $_POST['pick_etime'];
                // 일정알림시간 구하기
                if ($_POST['sst_all_day'] == 'N') {
                    if ($_POST['sst_schedule_alarm_chk'] == 'Y') {
                        // sst_pick_result 값이 시간(minute) 단위로 전송되므로, 이 값을 정수형으로 변환하여 사용합니다.
                        $sst_pick_result = intval($_POST['sst_pick_result']);
                        // sst_sdate 값을 DateTime 객체로 변환합니다.
                        $sst_sdatetime = new DateTime($sst_sdate);
                        if ($_POST['sst_pick_type'] == 'minute') {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result minute")->format('Y-m-d H:i:s');
                        } else if ($_POST['sst_pick_type'] == 'hour') {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result hour")->format('Y-m-d H:i:s');
                        } else if ($_POST['sst_pick_type'] == 'day') {
                            // sst_sdate로부터 sst_pick_result 시간 만큼 감산하여 알림 시간을 계산합니다.
                            $sst_schedule_alarm = $sst_sdatetime->modify("-$sst_pick_result day")->format('Y-m-d H:i:s');
                        }
                    }
                }

                unset($arr_query);
                $arr_query = array(
                    "mt_idx" => $_SESSION['_mt_idx'],
                    "sst_title" => $_POST['sst_title'],
                    "sst_sdate" => $sst_sdate,
                    "sst_edate" => $sst_edate,
                    "sst_all_day" => $_POST['sst_all_day'],
                    "sst_repeat_json" => $_POST['sst_repeat_json'],
                    "sst_repeat_json_v" => $_POST['sst_repeat_json_v'],
                    "sgt_idx" => $row_sgdt['sgt_idx'],
                    "sgdt_idx" => $_POST['sgdt_idx'],
                    "sgdt_idx_t" => $_POST['sgdt_idx_t'],
                    "sst_alram" => $_POST['sst_alram'],
                    "sst_alram_t" => $_POST['sst_alram_t'],
                    "slt_idx" => $_POST['slt_idx'],
                    "slt_idx_t" => $_POST['slt_idx_t'],
                    "sst_location_title" => $_POST['sst_location_title'],
                    "sst_location_add" => $_POST['sst_location_add'],
                    "sst_location_lat" => $_POST['sst_location_lat'],
                    "sst_location_long" => $_POST['sst_location_long'],
                    "sst_supplies" => $_POST['sst_supplies'],
                    "sst_memo" => $_POST['sst_memo'],
                    "sst_show" => "Y",
                    "sst_wdate" => $DB->now(),
                    "sst_adate" => $_POST['sst_adate'],
                    "sst_location_alarm" => $_POST['sst_location_alarm'],
                    "sst_schedule_alarm_chk" => $_POST['sst_schedule_alarm_chk'],
                    "sst_pick_type" => $_POST['sst_pick_type'],
                    "sst_pick_result" => $_POST['sst_pick_result'],
                    "sst_schedule_alarm" => $sst_schedule_alarm,
                    "sst_update_chk" => $_POST['sst_update_chk'],
                    "sst_sedate" => $_POST['sst_sdate'] . ' ~ ' . $_POST['sst_edate'],
                );
                if ($_last_idx) {
                    $arr_query['sst_pidx'] = $_last_idx;
                    $DB->insert('smap_schedule_t', $arr_query);
                } else {
                    $_last_idx = $DB->insert('smap_schedule_t', $arr_query);
                }
            }
        }
        //일정 확인하여 오너가 수정한지 본인이 수정한지 확인
        $DB->where('sst_idx', $_last_idx);
        $sst_row = $DB->getone('smap_schedule_t');

        $DB->where('sgdt_idx', $sst_row['sgdt_idx']);
        $sgdt_row = $DB->getone('smap_group_detail_t');

        if ($_SESSION['_mt_idx'] == $sgdt_row['mt_idx']) { //해당 일정이 본인 일정일 경우
            if ($sgdt_row['sgdt_owner_chk'] == 'Y' || $sgdt_row['sgdt_leader_chk'] == 'Y') { // 본인이 오너 or 리더일 경우
            } else { // 본인이 그룹원일 경우
                // 해당 그룹의 오너/리더 구하기
                $mem_row = get_member_t_info($sgdt_row['mt_idx']); // 그룹원 회원 정보
                $DB->where('sgt_idx', $sst_row['sgt_idx']);
                $DB->where('(sgdt_owner_chk ="Y" or sgdt_leader_chk="Y") and sgdt_exit = "N"');
                $sgdt_list = $DB->get('smap_group_detail_t');
                if ($sgdt_list) {
                    foreach ($sgdt_list as $sgdt_row_ol) {
                        unset($member_row);
                        $member_row = get_member_t_info($sgdt_row_ol['mt_idx']); // 오너/리더 회원정보
                        $plt_type = '2';
                        $sst_idx = $_last_idx;
                        $plt_condition = '그룹원이 자신의 일정 입력';
                        $plt_memo = '해당 그룹의 그룹오너/리더에게 일정이 생성되었다는 푸시알림';
                        // $mt_id = $member_row['mt_idx'];
                        $mt_id = $member_row['mt_id'] ? $member_row['mt_id'] : $member_row['mt_email'];
                        $member_nickname = $member_row['mt_nickname'] ? $member_row['mt_nickname'] : $member_row['mt_name'];
                        $mem_nickname = $mem_row['mt_nickname'] ? $mem_row['mt_nickname'] : $mem_row['mt_name'];
                        $translations_schedule = require $_SERVER['DOCUMENT_ROOT'] . '/lang/' . $member_row['mt_lang'] . '.php';
                        $plt_title = $translations_schedule['txt_schedule_created']; //일정 생성알림 ➕
                        $plt_content = $translations_schedule['txt_schedule_created_content']; //님이 새로운 일정을 생성했습니다.
                        $plt_content = str_replace('{nick_name}', $mem_nickname, $plt_content);

                        $result = api_push_send($plt_type, $sst_idx, $plt_condition, $plt_memo, $mt_id, $plt_title, $plt_content);
                    }
                }
            }
        } else { // 해당 일정이 본인 일정이 아닐 경우
            // 해당 되는 사람에게 일정알림 보내기
            $owner_row = get_member_t_info($_SESSION['_mt_idx']); // 오너/리더 회원 정보
            $member_row = get_member_t_info($sgdt_row['mt_idx']); // 그룹원 회원 정보
            $plt_type = '2';
            $sst_idx = $_last_idx;
            $plt_condition = '그룹오너가 그룹원 일정 입력';
            $plt_memo = '해당 그룹원에게 일정이 생성되었다는 푸시알림';
            // $mt_id = $member_row['mt_idx'];
            $mt_id = $member_row['mt_id'] ? $member_row['mt_id'] : $member_row['mt_email'];
            $member_nickname = $member_row['mt_nickname'] ? $member_row['mt_nickname'] : $member_row['mt_name'];
            $owner_nickname = $owner_row['mt_nickname'] ? $owner_row['mt_nickname'] : $owner_row['mt_name'];
            $translations_schedule = require $_SERVER['DOCUMENT_ROOT'] . '/lang/' . $member_row['mt_lang'] . '.php';
            $plt_title = $translations_schedule['txt_schedule_created']; //일정 생성알림 ➕
            $plt_content = $translations_schedule['txt_schedule_created_content_member']; //님이 새로운 일정을 생성했습니다.
            $plt_content = str_replace('{nick_name}', $owner_nickname, $plt_content);

            $result = api_push_send($plt_type, $sst_idx, $plt_condition, $plt_memo, $mt_id, $plt_title, $plt_content);
        }
    }
    //연락처 테이블 업데이트
    if ($_last_idx) {
        unset($arr_query);
        $arr_query = array(
            "sst_idx" => $_last_idx,
        );

        $DB->where('mt_idx', $_SESSION['_mt_idx']);
        $DB->where("sst_idx is null");

        $DB->update('smap_contact_t', $arr_query);
    }
    // p_gotourl("./schedule");
    echo "Y";
} elseif ($_POST['act'] == "check_repeat_schedule") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    if ($_POST['sst_idx'] == '') {
        p_alert('잘못된 접근입니다. sst_idx');
    }

    // 해당 일정이 반복 일정인지 확인
    $DB->where('sst_idx', $_POST['sst_idx']);
    $sst_row = $DB->getone('smap_schedule_t');

    // 반복 일정 여부 확인 (pidx가 있거나 자신이 pidx인 경우)
    $is_repeat = false;
    
    if ($sst_row['sst_pidx'] > 0) {
        // 자신이 반복 일정의 하위 일정인 경우
        $is_repeat = true;
    } else {
        // 자신이 반복 일정의 부모인 경우
        $DB->where('sst_pidx', $_POST['sst_idx']);
        $child_count = $DB->getValue('smap_schedule_t', "count(*)");
        
        if ($child_count > 0) {
            $is_repeat = true;
        }
    }

    echo $is_repeat ? 'Y' : 'N';
} elseif ($_POST['act'] == "schedule_edit") {
    // 디버깅을 위한 로그 추가
    logToFile("[일정 수정] 시작 - POST 데이터: " . print_r($_POST, true));
    logToFile("[일정 수정] 요청 IP: " . $_SERVER['REMOTE_ADDR'] . ", 사용자: " . $_SESSION['_mt_idx'] . ", 브라우저: " . $_SERVER['HTTP_USER_AGENT']);
    
    try {
        if ($_SESSION['_mt_idx'] == '') {
            logToFile("[일정 수정] 오류 - 세션 없음");
            echo 'N';
            exit;
        }
        if (!isset($_POST['sst_idx']) || $_POST['sst_idx'] == '') {
            logToFile("[일정 수정] 오류 - sst_idx 없음");
            echo 'N';
            exit;
        }
        
        // 필수 필드 검증 완화 (일부 필드 없을 수 있음)
        if (!isset($_POST['sst_title']) || trim($_POST['sst_title']) == '') {
            logToFile("[일정 수정] 경고 - 제목 누락, 기본값 사용");
            $_POST['sst_title'] = '제목 없음';
        }
        
        if (!isset($_POST['sst_sdate']) || trim($_POST['sst_sdate']) == '') {
            logToFile("[일정 수정] 경고 - 시작일 누락, 기본값 사용");
            $_POST['sst_sdate'] = date('Y-m-d');
        }
        
        if (!isset($_POST['sst_edate']) || trim($_POST['sst_edate']) == '') {
            logToFile("[일정 수정] 경고 - 종료일 누락, 기본값 사용");
            $_POST['sst_edate'] = $_POST['sst_sdate'];
        }
        
        if (!isset($_POST['sst_stime']) || trim($_POST['sst_stime']) == '') {
            logToFile("[일정 수정] 경고 - 시작시간 누락, 기본값 사용");
            $_POST['sst_stime'] = '00:00:00';
        }
        
        if (!isset($_POST['sst_etime']) || trim($_POST['sst_etime']) == '') {
            logToFile("[일정 수정] 경고 - 종료시간 누락, 기본값 사용");
            $_POST['sst_etime'] = '23:59:59';
        }

        // edit_type 확인 (단일 일정 또는 모든 반복 일정)
        $edit_type = isset($_POST['edit_type']) ? $_POST['edit_type'] : 'single';
        logToFile("[일정 수정] 편집 유형: " . $edit_type);

        // 일정 정보 가져오기
        $DB->where('sst_idx', $_POST['sst_idx']);
        $sst_row = $DB->getOne('smap_schedule_t');
        
        if (!$sst_row) {
            logToFile("[일정 수정] 오류 - 일정을 찾을 수 없음: " . $_POST['sst_idx']);
            echo 'N';
            exit;
        }
        
        logToFile("[일정 수정] 기존 일정 정보: " . print_r($sst_row, true));
        logToFile("[일정 수정] 일정 소유자: " . $sst_row['mt_idx'] . ", 현재 사용자: " . $_SESSION['_mt_idx']);
        
        // 권한 확인 (본인 일정만 수정 가능)
        if ($sst_row['mt_idx'] != $_SESSION['_mt_idx']) {
            logToFile("[일정 수정] 권한 오류 - 타인의 일정 수정 시도");
            echo 'N';
            exit;
        }

        // 시작 날짜/시간 및 종료 날짜/시간 설정
        $sst_sdate = $_POST['sst_sdate'];
        $sst_edate = $_POST['sst_edate'];
        
        // 날짜 형식에 이미 시간이 포함되어 있는지 확인
        if (strpos($sst_sdate, ':') === false && isset($_POST['sst_stime'])) {
            $sst_sdate .= ' ' . $_POST['sst_stime'];
        }
        
        if (strpos($sst_edate, ':') === false && isset($_POST['sst_etime'])) {
            $sst_edate .= ' ' . $_POST['sst_etime'];
        }
        
        logToFile("[일정 수정] 설정된 시작/종료 시간: " . $sst_sdate . " ~ " . $sst_edate);

        // 알림 시간 설정
        $sst_schedule_alarm = '';
        if (isset($_POST['sst_alarm']) && $_POST['sst_alarm'] == 'Y' && isset($_POST['sst_alarm_time']) && $_POST['sst_alarm_time'] != '') {
            $sst_stime_t = strtotime($sst_sdate);
            if ($sst_stime_t !== false) {
                $sst_alarm_time_t = $sst_stime_t - (intval($_POST['sst_alarm_time']) * 60);
                $sst_schedule_alarm = date('Y-m-d H:i:s', $sst_alarm_time_t);
                logToFile("[일정 수정] 알림 시간 설정: " . $sst_schedule_alarm);
            } else {
                logToFile("[일정 수정] 경고 - 잘못된 시작 시간 형식: " . $sst_sdate);
            }
        }

        // 업데이트할 데이터 준비
        $update_data = array(
            "sst_title" => $_POST['sst_title'],
            "sst_sdate" => $sst_sdate,
            "sst_edate" => $sst_edate,
            "sst_sedate" => $sst_sdate . ' ~ ' . $sst_edate,
            "sst_udate" => $DB->now()
        );
        
        // slt_idx_t 설정 (위치 주소 사용)
        if (isset($_POST['sst_location_add']) && $_POST['sst_location_add'] != '') {
            $update_data['slt_idx_t'] = $_POST['sst_location_add'];
        }
        
        // 기존 일정 정보에서 필드 복사 (POST에 없는 경우)
        $fields_to_copy = array(
            'sst_content', 'sst_place', 'sst_alram', 'sst_alram_t', 
            'sst_location_title', 'sst_location_add', 'sst_location_lat', 'sst_location_long',
            'sst_location_alarm', 'sst_location_detail', 'sst_memo', 'sst_supplies', 'slt_idx',
            'sst_all_day', 'sgt_idx', 'sst_pick_type', 'sst_pick_result', 
            'sst_schedule_alarm', 'sst_update_chk'
        );
        
        foreach ($fields_to_copy as $field) {
            if (!isset($_POST[$field]) && isset($sst_row[$field]) && $sst_row[$field] != '') {
                $update_data[$field] = $sst_row[$field];
                logToFile("[일정 수정] 기존 데이터에서 복사: $field = " . $sst_row[$field]);
            }
        }
        
        // 일정 알람 추가
        if (isset($_POST['sst_alarm'])) {
            $update_data["sst_alram"] = $_POST['sst_alarm'];
        }
        
        // 일정 알림 타입 및 결과
        if (isset($_POST['sst_pick_type']) && isset($_POST['sst_pick_result'])) {
            $update_data["sst_pick_type"] = $_POST['sst_pick_type'];
            $update_data["sst_pick_result"] = $_POST['sst_pick_result'];
            
            // sst_alram_t 필드 생성 (sst_pick_type과 sst_pick_result의 조합)
            $pick_type = $_POST['sst_pick_type'];
            $pick_result = $_POST['sst_pick_result'];
            
            $alram_t = '';
            if ($pick_type == 'minute') {
                $alram_t = $pick_result . ' ' . $translations['txt_minutes_ago'];
            } else if ($pick_type == 'hour') {
                $alram_t = $pick_result . ' ' . $translations['txt_hours_ago'];
            } else if ($pick_type == 'day') {
                $alram_t = $pick_result . ' ' . $translations['txt_days_ago'];
            }

            if (!empty($alram_t)) {
                $update_data["sst_alram_t"] = $alram_t;
                logToFile("[일정 수정] sst_alram_t 생성: " . $alram_t);
            }
        } else if (isset($_POST['sst_alarm_time'])) {
            $update_data["sst_alram_t"] = $_POST['sst_alarm_time'];
        }
        
        // 일정 알림 여부 체크
        if (isset($_POST['sst_schedule_alarm_chk'])) {
            $update_data["sst_schedule_alarm_chk"] = $_POST['sst_schedule_alarm_chk'];
        }
        
        // 일정 알림 타입 및 결과
        if (isset($_POST['sst_pick_type'])) {
            $update_data["sst_pick_type"] = $_POST['sst_pick_type'];
        }
        
        if (isset($_POST['sst_pick_result'])) {
            $update_data["sst_pick_result"] = $_POST['sst_pick_result'];
        }
        
        // 반복 일정 정보 추가
        if (isset($_POST['sst_repeat_json'])) {
            $update_data["sst_repeat_json"] = $_POST['sst_repeat_json'];
        }
        
        if (isset($_POST['sst_repeat_json_v'])) {
            $update_data["sst_repeat_json_v"] = $_POST['sst_repeat_json_v'];
        }
        
        // 선택적 필드 추가
        if (isset($_POST['sst_content'])) {
            $update_data["sst_content"] = $_POST['sst_content'];
        }
        
        if (isset($_POST['sst_place'])) {
            $update_data["sst_place"] = $_POST['sst_place'];
        }
        
        if (isset($_POST['sst_alram'])) {
            $update_data["sst_alram"] = $_POST['sst_alram'];
            $update_data["sst_schedule_alarm"] = $sst_schedule_alarm;
        }
        
        // 준비물, 메모 필드 추가
        if (isset($_POST['sst_supplies'])) {
            $update_data["sst_supplies"] = $_POST['sst_supplies'];
        }
        
        if (isset($_POST['sst_memo'])) {
            $update_data["sst_memo"] = $_POST['sst_memo'];
        }
        
        // 위치 관련 필드 추가
        if (isset($_POST['slt_idx'])) {
            $update_data["slt_idx"] = $_POST['slt_idx'];
        }
        
        if (isset($_POST['sst_all_day'])) {
            $update_data["sst_all_day"] = $_POST['sst_all_day'];
        }
        
        // 위치 상세 정보 필드 추가
        if (isset($_POST['sst_location_title'])) {
            $update_data["sst_location_title"] = $_POST['sst_location_title'];
            logToFile("[일정 수정] 위치 제목 설정: " . $_POST['sst_location_title']);
        }
        
        if (isset($_POST['sst_location_add'])) {
            $update_data["sst_location_add"] = $_POST['sst_location_add'];
            logToFile("[일정 수정] 위치 주소 설정: " . $_POST['sst_location_add']);
        }
        
        if (isset($_POST['sst_location_lat'])) {
            $update_data["sst_location_lat"] = $_POST['sst_location_lat'];
            logToFile("[일정 수정] 위치 위도 설정: " . $_POST['sst_location_lat']);
        }
        
        if (isset($_POST['sst_location_long'])) {
            $update_data["sst_location_long"] = $_POST['sst_location_long'];
            logToFile("[일정 수정] 위치 경도 설정: " . $_POST['sst_location_long']);
        }
        
        if (isset($_POST['sst_location_alarm'])) {
            $update_data["sst_location_alarm"] = $_POST['sst_location_alarm'];
            logToFile("[일정 수정] 위치 알림 설정: " . $_POST['sst_location_alarm']);
        }
        
        // 위치 상세 정보 필드 추가
        if (isset($_POST['sst_location_detail']) && $_POST['sst_location_detail'] != '') {
            $update_data['sst_location_detail'] = $_POST['sst_location_detail'];
            logToFile("[일정 수정] 위치 상세 정보 설정: " . $_POST['sst_location_detail']);
        }
        
        // 메모 필드 추가
        if (isset($_POST['sst_memo']) && $_POST['sst_memo'] != '') {
            $update_data['sst_memo'] = $_POST['sst_memo'];
            logToFile("[일정 수정] 메모 설정: " . $_POST['sst_memo']);
        }
        
        // 준비물 필드 추가
        if (isset($_POST['sst_supplies']) && $_POST['sst_supplies'] != '') {
            $update_data['sst_supplies'] = $_POST['sst_supplies'];
            logToFile("[일정 수정] 준비물 설정: " . $_POST['sst_supplies']);
        }
        
        // 연락처 정보 처리
        if (isset($_POST['contact_ids'])) {
            try {
                $contact_ids = json_decode($_POST['contact_ids'], true);
                
                if (is_array($contact_ids) && count($contact_ids) > 0) {
                    logToFile("[일정 수정] 연락처 IDs 처리: " . print_r($contact_ids, true));
                    
                    // 일정의 부모 ID (sst_pidx) 가져오기
                    $schedule_id = $_POST['sst_idx'];
                    $parent_id = $sst_row['sst_pidx'] > 0 ? $sst_row['sst_pidx'] : $schedule_id;
                    
                    logToFile("[일정 수정] 연락처 연결 대상 일정 ID: " . $parent_id . " (원래 일정 ID: " . $schedule_id . ")");
                    
                    // 기존 연락처 데이터 정리
                    $DB->where('sst_idx', $parent_id);
                    $existing_contacts = $DB->get('smap_contact_t', null, 'sct_idx');
                    
                    $existing_contact_ids = [];
                    if ($existing_contacts) {
                        foreach ($existing_contacts as $contact) {
                            $existing_contact_ids[] = $contact['sct_idx'];
                        }
                    }
                    
                    logToFile("[일정 수정] 기존 연락처 IDs: " . print_r($existing_contact_ids, true));
                    
                    // 추가된 연락처와 제거된 연락처 식별
                    $added_contacts = array_diff($contact_ids, $existing_contact_ids);
                    $removed_contacts = array_diff($existing_contact_ids, $contact_ids);
                    
                    logToFile("[일정 수정] 추가될 연락처: " . print_r($added_contacts, true));
                    logToFile("[일정 수정] 제거될 연락처: " . print_r($removed_contacts, true));
                    
                    // 각 연락처에 대해 처리
                    foreach ($contact_ids as $contact_id) {
                        // 연락처가 존재하는지 확인
                        $DB->where('sct_idx', $contact_id);
                        $contact_exists = $DB->getOne('smap_contact_t');
                        
                        if ($contact_exists) {
                            // smap_contact_t 테이블의 sst_idx 필드에 부모 일정 ID 업데이트
                            $DB->where('sct_idx', $contact_id);
                            $result = $DB->update('smap_contact_t', ['sst_idx' => $parent_id]);
                            logToFile("[일정 수정] 연락처 연결 업데이트: sct_idx=" . $contact_id . ", sst_idx=" . $parent_id . ", 결과: " . ($result ? "성공" : "실패"));
                            
                            if (!$result) {
                                logToFile("[일정 수정] 연락처 업데이트 SQL 오류: " . $DB->getLastError());
                            }
                        } else {
                            logToFile("[일정 수정] 존재하지 않는 연락처 ID: " . $contact_id);
                        }
                    }
                    
                    // 제거된 연락처 처리
                    foreach ($removed_contacts as $contact_id) {
                        $DB->where('sct_idx', $contact_id);
                        $result = $DB->update('smap_contact_t', ['sst_idx' => 0]);
                        logToFile("[일정 수정] 연락처 연결 해제: sct_idx=" . $contact_id . ", 결과: " . ($result ? "성공" : "실패"));
                    }
                }
            } catch (Exception $e) {
                logToFile("[일정 수정] 연락처 처리 중 오류: " . $e->getMessage());
            }
        }

        logToFile("[일정 수정] 업데이트할 데이터: " . print_r($update_data, true));

        $result = false;

        // 반복 일정 수정 처리
        if ($edit_type == 'single') {
            // 단일 일정 수정 - 전체 입력값을 모두 업데이트
            $DB->where('sst_idx', $_POST['sst_idx']);
            $result = $DB->update('smap_schedule_t', $update_data);
            logToFile("[일정 수정] 단일 일정 수정 결과: " . ($result ? "성공" : "실패") . ", SQL: " . $DB->getLastQuery());
            if ($result === false) {
                logToFile("[일정 수정] SQL 오류: " . $DB->getLastError());
            }
        } else if ($edit_type == 'all') {
            // 모든 반복 일정 수정 (해당 일정 및 관련 반복 일정)
            // 기존 일정을 전부 삭제하고 일정을 다시 생성
            $result = true;
            
            if ($sst_row['sst_pidx'] > 0) {
                // 자신이 반복 일정의 하위 일정인 경우
                // 부모 일정과 모든 하위 일정 삭제
                $parent_id = $sst_row['sst_pidx'];
                
                // 현재 일정의 시작 날짜 가져오기
                $current_date = date('Y-m-d', strtotime($sst_row['sst_sdate']));
                
                // 현재 일정 이후의 하위 일정만 삭제 (이전 일정은 유지)
                $DB->where('sst_pidx', $parent_id);
                $DB->where("DATE(sst_sdate) >= ?", [$current_date]);
                $children_delete = $DB->delete('smap_schedule_t');
                logToFile("[일정 수정] 이후 하위 일정 삭제 결과: " . ($children_delete ? "성공 (" . $DB->count . "개 삭제)" : "실패") . ", SQL: " . $DB->getLastQuery());
                
                // 부모 일정 업데이트 (삭제하지 않고 업데이트)
                $DB->where('sst_idx', $parent_id);
                $parent_update = $DB->update('smap_schedule_t', $update_data);
                logToFile("[일정 수정] 부모 일정 업데이트 결과: " . ($parent_update ? "성공" : "실패") . ", SQL: " . $DB->getLastQuery());
                
                if ($parent_update) {
                    // 반복 일정 정보가 있으면 새 하위 일정 생성
                    if (isset($_POST['sst_repeat_json']) && $_POST['sst_repeat_json']) {
                        // 반복 일정 정보 처리 로직 (기존 코드 활용)
                        $repeat_json = $_POST['sst_repeat_json'];
                        $repeat_data = json_decode($repeat_json, true);
                        
                        if ($repeat_data && isset($repeat_data['r1']) && $repeat_data['r1'] > 1) {
                            // 반복 유형에 따른 날짜 생성
                            $start_date = new DateTime($sst_sdate);
                            $end_date = new DateTime($sst_edate);
                            $interval = $start_date->diff($end_date);
                            
                            $repeat_dates = [];
                            $current_date = clone $start_date;
                            
                            // 반복 유형에 따라 날짜 생성 (3년 기간으로 제한)
                            $end_limit_date = (new DateTime())->modify('+3 years');
                            $count = 0;
                            
                            switch ($repeat_data['r1']) {
                                case '2': // 매일
                                    while ($current_date < $end_limit_date) {
                                        $current_date->add(new DateInterval('P1D'));
                                        $repeat_dates[] = $current_date->format('Y-m-d');
                                        $count++;
                                    }
                                    break;
                                case '3': // 매주
                                    // r2 값이 있는 경우 (요일 지정)
                                    if (isset($repeat_data['r2']) && !empty($repeat_data['r2'])) {
                                        $selected_days = explode(',', $repeat_data['r2']);
                                        logToFile("[일정 수정] 선택된 요일: " . print_r($selected_days, true));
                                        
                                        // 요일 값 변환 (0-6 또는 1-7 형식 모두 처리)
                                        $converted_days = [];
                                        foreach ($selected_days as $day) {
                                            // 숫자로 변환
                                            $day_num = intval($day);
                                            
                                            // 0-6 형식인 경우 1-7 형식으로 변환
                                            if ($day_num >= 0 && $day_num <= 6) {
                                                // 0(일요일)을 7(일요일)로 변환
                                                if ($day_num == 0) {
                                                    $converted_days[] = '7';
                                                } else {
                                                    // 1-6은 그대로 사용 (월-토)
                                                    $converted_days[] = (string)$day_num;
                                                }
                                            } 
                                            // 1-7 형식인 경우 그대로 사용
                                            else if ($day_num >= 1 && $day_num <= 7) {
                                                $converted_days[] = (string)$day_num;
                                            }
                                        }
                                        logToFile("[일정 수정] 변환된 요일: " . print_r($converted_days, true));
                                        
                                        // 중복 제거 및 정렬
                                        $converted_days = array_unique($converted_days);
                                        sort($converted_days);
                                        
                                        logToFile("[일정 수정] 변환된 요일(중복 제거): " . print_r($converted_days, true));
                                        
                                        // 현재 날짜부터 3년까지 반복
                                        $temp_date = clone $start_date;
                                        
                                        // 시작일의 요일 확인
                                        $start_day_of_week = $start_date->format('N');
                                        
                                        // 이미 처리한 날짜를 추적하기 위한 배열
                                        $processed_dates = [];
                                        
                                        while ($temp_date < $end_limit_date) {
                                            // 현재 요일 (1: 월요일, 7: 일요일)
                                            $current_day_of_week = $temp_date->format('N');
                                            $current_date_str = $temp_date->format('Y-m-d');
                                            
                                            // 선택된 요일인 경우에만 추가
                                            if (in_array($current_day_of_week, $converted_days)) {
                                                // 시작일과 같은 날짜는 제외 (중복 방지)
                                                // 이미 처리한 날짜도 제외
                                                if ($current_date_str != $start_date->format('Y-m-d') && !in_array($current_date_str, $processed_dates)) {
                                                    $repeat_dates[] = $current_date_str;
                                                    $processed_dates[] = $current_date_str;
                                                    logToFile("[일정 수정] 반복 일정 날짜 추가: " . $current_date_str . " (요일: " . $current_day_of_week . ")");
                                                    $count++;
                                                }
                                            }
                                            
                                            // 하루씩 증가
                                            $temp_date->add(new DateInterval('P1D'));
                                        }
                                    } else {
                                        // 기존 로직 (매주 같은 요일)
                                        while ($current_date < $end_limit_date) {
                                            $current_date->add(new DateInterval('P7D'));
                                            $repeat_dates[] = $current_date->format('Y-m-d');
                                            $count++;
                                        }
                                    }
                                    break;
                                case '4': // 매월
                                    while ($current_date < $end_limit_date) {
                                        $current_date->add(new DateInterval('P1M'));
                                        $repeat_dates[] = $current_date->format('Y-m-d');
                                        $count++;
                                    }
                                    break;
                                case '5': // 매년
                                    while ($current_date < $end_limit_date) {
                                        $current_date->add(new DateInterval('P1Y'));
                                        $repeat_dates[] = $current_date->format('Y-m-d');
                                        $count++;
                                    }
                                    break;
                            }
                            
                            // 날짜 배열 중복 제거 및 정렬
                            $repeat_dates = array_unique($repeat_dates);
                            sort($repeat_dates);
                            logToFile("[일정 수정] 최종 반복 일정 날짜 (중복 제거): " . count($repeat_dates) . "개, 날짜: " . implode(", ", $repeat_dates));
                            
                            // 생성된 날짜로 하위 일정 생성
                            foreach ($repeat_dates as $date) {
                                $child_data = $update_data;
                                $child_data['mt_idx'] = $_SESSION['_mt_idx'];
                                $child_data['sgdt_idx'] = $sst_row['sgdt_idx'];
                                $child_data['sst_pidx'] = $parent_id;
                                $child_data['sst_show'] = 'Y';
                                $child_data['sst_wdate'] = $DB->now();
                                
                                // 날짜 조정
                                $child_start = new DateTime($date . ' ' . date('H:i:s', strtotime($sst_sdate)));
                                $child_end = clone $child_start;
                                $child_end->add($interval);
                                
                                $child_data['sst_sdate'] = $child_start->format('Y-m-d H:i:s');
                                $child_data['sst_edate'] = $child_end->format('Y-m-d H:i:s');
                                $child_data['sst_sedate'] = $child_data['sst_sdate'] . ' ~ ' . $child_data['sst_edate'];
                                
                                // slt_idx_t 설정 (위치 주소 사용)
                                if (isset($child_data['sst_location_add']) && $child_data['sst_location_add'] != '') {
                                    $child_data['slt_idx_t'] = $child_data['sst_location_add'];
                                }
                                
                                $child_id = $DB->insert('smap_schedule_t', $child_data);
                                logToFile("[일정 수정] 하위 일정 생성 결과: " . ($child_id ? "성공 (ID: $child_id)" : "실패") . ", 날짜: $date");
                            }
                        }
                    }
                    
                    // 연락처 정보 업데이트
                    if (isset($_POST['contact_ids'])) {
                        try {
                            $contact_ids = json_decode($_POST['contact_ids'], true);
                            
                            if (is_array($contact_ids) && count($contact_ids) > 0) {
                                foreach ($contact_ids as $contact_id) {
                                    $DB->where('sct_idx', $contact_id);
                                    $result = $DB->update('smap_contact_t', ['sst_idx' => $parent_id]);
                                    logToFile("[일정 수정] 연락처 연결 업데이트: sct_idx=" . $contact_id . ", sst_idx=" . $parent_id . ", 결과: " . ($result ? "성공" : "실패"));
                                }
                            }
                        } catch (Exception $e) {
                            logToFile("[일정 수정] 연락처 처리 중 오류: " . $e->getMessage());
                        }
                    }
                    
                    $result = $parent_id ? true : false;
                } else {
                    $result = false;
                }
            } else {
                // 자신이 반복 일정의 부모인 경우
                // 현재 일정의 시작 날짜 가져오기
                $current_date = date('Y-m-d', strtotime($sst_sdate));
                
                // 현재 일정 이후의 하위 일정 모두 삭제 (이전 일정은 유지)
                $DB->where("sst_pidx", $_POST["sst_idx"]);
                $DB->where("DATE(sst_sdate) >= ?", [$current_date]);
                $children_delete = $DB->delete('smap_schedule_t');
                logToFile("[일정 수정] 이후 하위 일정 삭제 결과: " . ($children_delete ? "성공 (" . $DB->count . "개 삭제)" : "실패") . ", SQL: " . $DB->getLastQuery());
                
                // 부모 일정 업데이트 (삭제하지 않고 업데이트)
                $DB->where('sst_idx', $_POST['sst_idx']);
                $parent_update = $DB->update('smap_schedule_t', $update_data);
                logToFile("[일정 수정] 부모 일정 업데이트 결과: " . ($parent_update ? "성공" : "실패") . ", SQL: " . $DB->getLastQuery());
                
                if ($parent_update) {
                    // 반복 일정 정보가 있으면 새 하위 일정 생성
                    if (isset($_POST['sst_repeat_json']) && $_POST['sst_repeat_json']) {
                        // 반복 일정 정보 처리 로직 (기존 코드 활용)
                        $repeat_json = $_POST['sst_repeat_json'];
                        $repeat_data = json_decode($repeat_json, true);
                        
                        if ($repeat_data && isset($repeat_data['r1']) && $repeat_data['r1'] > 1) {
                            // 반복 유형에 따른 날짜 생성
                            $start_date = new DateTime($sst_sdate);
                            $end_date = new DateTime($sst_edate);
                            $interval = $start_date->diff($end_date);
                            
                            $repeat_dates = [];
                            $current_date = clone $start_date;
                            
                            // 반복 유형에 따라 날짜 생성 (3년 기간으로 제한)
                            $end_limit_date = (new DateTime())->modify('+3 years');
                            $count = 0;
                            
                            switch ($repeat_data['r1']) {
                                case '2': // 매일
                                    while ($current_date < $end_limit_date) {
                                        $current_date->add(new DateInterval('P1D'));
                                        $repeat_dates[] = $current_date->format('Y-m-d');
                                        $count++;
                                    }
                                    break;
                                case '3': // 매주
                                    // r2 값이 있는 경우 (요일 지정)
                                    if (isset($repeat_data['r2']) && !empty($repeat_data['r2'])) {
                                        $selected_days = explode(',', $repeat_data['r2']);
                                        logToFile("[일정 수정] 선택된 요일: " . print_r($selected_days, true));
                                        
                                        // 요일 값 변환 (0-6 또는 1-7 형식 모두 처리)
                                        $converted_days = [];
                                        foreach ($selected_days as $day) {
                                            // 숫자로 변환
                                            $day_num = intval($day);
                                            
                                            // 0-6 형식인 경우 1-7 형식으로 변환
                                            if ($day_num >= 0 && $day_num <= 6) {
                                                // 0(일요일)을 7(일요일)로 변환
                                                if ($day_num == 0) {
                                                    $converted_days[] = '7';
                                                } else {
                                                    // 1-6은 그대로 사용 (월-토)
                                                    $converted_days[] = (string)$day_num;
                                                }
                                            } 
                                            // 1-7 형식인 경우 그대로 사용
                                            else if ($day_num >= 1 && $day_num <= 7) {
                                                $converted_days[] = (string)$day_num;
                                            }
                                        }
                                        logToFile("[일정 수정] 변환된 요일: " . print_r($converted_days, true));
                                        
                                        // 중복 제거 및 정렬
                                        $converted_days = array_unique($converted_days);
                                        sort($converted_days);
                                        
                                        logToFile("[일정 수정] 변환된 요일(중복 제거): " . print_r($converted_days, true));
                                        
                                        // 현재 날짜부터 3년까지 반복
                                        $temp_date = clone $start_date;
                                        
                                        // 시작일의 요일 확인
                                        $start_day_of_week = $start_date->format('N');
                                        
                                        // 이미 처리한 날짜를 추적하기 위한 배열
                                        $processed_dates = [];
                                        
                                        while ($temp_date < $end_limit_date) {
                                            // 현재 요일 (1: 월요일, 7: 일요일)
                                            $current_day_of_week = $temp_date->format('N');
                                            $current_date_str = $temp_date->format('Y-m-d');
                                            
                                            // 선택된 요일인 경우에만 추가
                                            if (in_array($current_day_of_week, $converted_days)) {
                                                // 시작일과 같은 날짜는 제외 (중복 방지)
                                                // 이미 처리한 날짜도 제외
                                                if ($current_date_str != $start_date->format('Y-m-d') && !in_array($current_date_str, $processed_dates)) {
                                                    $repeat_dates[] = $current_date_str;
                                                    $processed_dates[] = $current_date_str;
                                                    logToFile("[일정 수정] 반복 일정 날짜 추가: " . $current_date_str . " (요일: " . $current_day_of_week . ")");
                                                    $count++;
                                                }
                                            }
                                            
                                            // 하루씩 증가
                                            $temp_date->add(new DateInterval('P1D'));
                                        }
                                    } else {
                                        // 기존 로직 (매주 같은 요일)
                                        while ($current_date < $end_limit_date) {
                                            $current_date->add(new DateInterval('P7D'));
                                            $repeat_dates[] = $current_date->format('Y-m-d');
                                            $count++;
                                        }
                                    }
                                    break;
                                case '4': // 매월
                                    while ($current_date < $end_limit_date) {
                                        $current_date->add(new DateInterval('P1M'));
                                        $repeat_dates[] = $current_date->format('Y-m-d');
                                        $count++;
                                    }
                                    break;
                                case '5': // 매년
                                    while ($current_date < $end_limit_date) {
                                        $current_date->add(new DateInterval('P1Y'));
                                        $repeat_dates[] = $current_date->format('Y-m-d');
                                        $count++;
                                    }
                                    break;
                            }
                            
                            // 날짜 배열 중복 제거 및 정렬
                            $repeat_dates = array_unique($repeat_dates);
                            sort($repeat_dates);
                            logToFile("[일정 수정] 최종 반복 일정 날짜 (중복 제거): " . count($repeat_dates) . "개, 날짜: " . implode(", ", $repeat_dates));
                            
                            // 생성된 날짜로 하위 일정 생성
                            foreach ($repeat_dates as $date) {
                                $child_data = $update_data;
                                $child_data['mt_idx'] = $_SESSION['_mt_idx'];
                                $child_data['sgdt_idx'] = $sst_row['sgdt_idx'];
                                $child_data['sst_pidx'] = $_POST['sst_idx'];
                                $child_data['sst_show'] = 'Y';
                                $child_data['sst_wdate'] = $DB->now();
                                
                                // 날짜 조정
                                $child_start = new DateTime($date . ' ' . date('H:i:s', strtotime($sst_sdate)));
                                $child_end = clone $child_start;
                                $child_end->add($interval);
                                
                                $child_data['sst_sdate'] = $child_start->format('Y-m-d H:i:s');
                                $child_data['sst_edate'] = $child_end->format('Y-m-d H:i:s');
                                
                                // slt_idx_t에 sst_location_add 값 설정
                                if (isset($child_data['sst_location_add']) && $child_data['sst_location_add'] != '') {
                                    $child_data['slt_idx_t'] = $child_data['sst_location_add'];
                                }
                                
                                // sst_sedate 설정
                                $child_data["sst_sedate"] = $child_data['sst_sdate'] . ' ~ ' . $child_data['sst_edate'];
                                
                                $child_id = $DB->insert('smap_schedule_t', $child_data);
                                logToFile("[일정 수정] 하위 일정 생성 결과: " . ($child_id ? "성공 (ID: $child_id)" : "실패") . ", 날짜: $date");
                            }
                        }
                    }
                    
                    $result = true;
                } else {
                    $result = false;
                }
            }
        }

        // 성공 여부 반환
        if ($result !== false) {
            logToFile("[일정 수정] 완료, 'Y' 반환");
            logToFile("[일정 수정] 최종 업데이트 데이터: " . print_r($update_data, true));
            logToFile("[일정 수정] 최종 SQL 쿼리: " . $DB->getLastQuery());
            echo 'Y';
        } else {
            logToFile("[일정 수정] 실패, 'N' 반환, 오류: " . $DB->getLastError());
            logToFile("[일정 수정] 실패한 SQL 쿼리: " . $DB->getLastQuery());
            echo 'N';
        }
    } catch (Exception $e) {
        logToFile("[일정 수정] 예외 발생: " . $e->getMessage() . "\n" . $e->getTraceAsString());
        logToFile("[일정 수정] 예외 발생 시점의 POST 데이터: " . print_r($_POST, true));
        echo 'N';
    }
} elseif ($_POST['act'] == "schedule_delete") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    if ($_POST['sst_idx'] == '') {
        p_alert('잘못된 접근입니다. sst_idx');
    }

    // 일정 정보 가져오기
    $DB->where('sst_idx', $_POST['sst_idx']);
    $sst_row = $DB->getone('smap_schedule_t');

    // 삭제 유형 확인 (단일 일정 또는 모든 반복 일정)
    $delete_type = isset($_POST['delete_type']) ? $_POST['delete_type'] : 'single';

    if ($delete_type == 'all') {
        // 모든 반복 일정 삭제 (해당 일자 및 이후만)
        if ($sst_row['sst_pidx'] > 0) {
            // 자신이 반복 일정의 하위 일정인 경우
            $parent_idx = $sst_row['sst_pidx'];
            
            // 현재 일정의 시작 날짜 가져오기
            $current_date = date('Y-m-d', strtotime($sst_row['sst_sdate']));
            
            // 부모 일정 삭제 (실제로는 숨김 처리)
            unset($arr_query);
            $arr_query = array(
                "sst_show" => 'N',
                "sst_ddate" => $DB->now(),
            );
            $DB->where('sst_idx', $parent_idx);
            $DB->update('smap_schedule_t', $arr_query);
            
            // 현재 일정 및 이후의 반복 일정만 삭제
            unset($arr_query);
            $arr_query = array(
                "sst_show" => 'N',
                "sst_ddate" => $DB->now(),
            );
            $DB->where('sst_pidx', $parent_idx);
            $DB->where("DATE(sst_sdate) >= ?", [$current_date]);
            $DB->update('smap_schedule_t', $arr_query);
        } else {
            // 자신이 반복 일정의 부모인 경우
            // 현재 일정의 시작 날짜 가져오기
            $current_date = date('Y-m-d', strtotime($sst_row['sst_sdate']));
            
            // 부모 일정 삭제 (실제로는 숨김 처리)
            unset($arr_query);
            $arr_query = array(
                "sst_show" => 'N',
                "sst_ddate" => $DB->now(),
            );
            $DB->where('sst_idx', $_POST['sst_idx']);
            $DB->update('smap_schedule_t', $arr_query);
            
            // 현재 일정 및 이후의 반복 일정만 삭제
            unset($arr_query);
            $arr_query = array(
                "sst_show" => 'N',
                "sst_ddate" => $DB->now(),
            );
            $DB->where('sst_pidx', $_POST['sst_idx']);
            $DB->where("DATE(sst_sdate) >= ?", [$current_date]);
            $DB->update('smap_schedule_t', $arr_query);
        }
    } else {
        // 단일 일정만 삭제
        unset($arr_query);
        $arr_query = array(
            "sst_show" => 'N',
            "sst_ddate" => $DB->now(),
        );
        $DB->where('sst_idx', $_POST['sst_idx']);
        $DB->update('smap_schedule_t', $arr_query);
    }

    // 그룹 정보 가져오기
    $DB->where('sgdt_idx', $sst_row['sgdt_idx']);
    $sgdt_row = $DB->getone('smap_group_detail_t');

    if ($_SESSION['_mt_idx'] == $sgdt_row['mt_idx']) { //해당 일정이 본인 일정일 경우
        if ($sgdt_row['sgdt_owner_chk'] == 'Y' || $sgdt_row['sgdt_leader_chk'] == 'Y') { // 본인이 오너 or 리더일 경우
        } else { // 본인이 그룹원일 경우
            // 해당 그룹의 오너/리더 구하기
            $mem_row = get_member_t_info($sgdt_row['mt_idx']); // 그룹원 회원 정보
            $DB->where('sgt_idx', $sst_row['sgt_idx']);
            $DB->where('(sgdt_owner_chk ="Y" or sgdt_leader_chk="Y") and sgdt_exit = "N"');
            $sgdt_list = $DB->get('smap_group_detail_t');
            if ($sgdt_list) {
                foreach ($sgdt_list as $sgdt_row_ol) {
                    unset($member_row);
                    $member_row = get_member_t_info($sgdt_row_ol['mt_idx']); // 오너/리더 회원정보
                    $plt_type = '2';
                    $sst_idx = $sst_row['sst_idx'];
                    $plt_condition = '그룹원이 자신의 일정 삭제';
                    $plt_memo = '해당 그룹의 그룹오너/리더에게 일정이 삭제되었다는 푸시알림';
                    // $mt_id = $member_row['mt_idx'];
                    $mt_id = $member_row['mt_id'] ? $member_row['mt_id'] : $member_row['mt_email'];
                    $member_nickname = $member_row['mt_nickname'] ? $member_row['mt_nickname'] : $member_row['mt_name'];
                    $mem_nickname = $mem_row['mt_nickname'] ? $mem_row['mt_nickname'] : $mem_row['mt_name'];
                    $translations_schedule = require $_SERVER['DOCUMENT_ROOT'] . '/lang/' . $member_row['mt_lang'] . '.php';
                    $plt_title = $translations_schedule['txt_schedule_deleted']; //일정 삭제 알림 ❌
                    $plt_content = $translations_schedule['txt_schedule_deleted_content'];
                    $plt_content = str_replace('{nick_name}', $mem_nickname, $plt_content);
                    $plt_content = str_replace('{sst_title}', $sst_row['sst_title'], $plt_content);

                    $result = api_push_send($plt_type, $sst_idx, $plt_condition, $plt_memo, $mt_id, $plt_title, $plt_content);
                }
            }
        }
    } else { // 해당 일정이 본인 일정이 아닐 경우
        // 해당 되는 사람에게 일정알림 보내기
        $owner_row = get_member_t_info($_SESSION['_mt_idx']); // 오너/리더 회원 정보
        $member_row = get_member_t_info($sgdt_row['mt_idx']); // 그룹원 회원 정보
        $plt_type = '2';
        $sst_idx = $sst_row['sst_idx'];
        $plt_condition = '그룹오너가 그룹원 일정 삭제';
        $plt_memo = '해당 그룹원에게 일정이 삭제되었다는 푸시알림';
        // $mt_id = $member_row['mt_idx'];
        $mt_id = $member_row['mt_id'] ? $member_row['mt_id'] : $member_row['mt_email'];
        $member_nickname = $member_row['mt_nickname'] ? $member_row['mt_nickname'] : $member_row['mt_name'];
        $owner_nickname = $owner_row['mt_nickname'] ? $owner_row['mt_nickname'] : $owner_row['mt_name'];
        $translations_schedule = require $_SERVER['DOCUMENT_ROOT'] . '/lang/' . $member_row['mt_lang'] . '.php';
        $plt_title = $translations_schedule['txt_schedule_deleted']; //일정 삭제 알림 ❌
        $plt_content = $translations_schedule['txt_schedule_deleted_content_member'];
        $plt_content = str_replace('{nick_name}', $owner_nickname, $plt_content);
        $plt_content = str_replace('{sst_title}', $sst_row['sst_title'], $plt_content);

        $result = api_push_send($plt_type, $sst_idx, $plt_condition, $plt_memo, $mt_id, $plt_title, $plt_content);
    }

    echo "Y";
} elseif ($_POST['act'] == "calendar_list") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    if ($_POST['sgdt_mt_idx']) {
        $mt_idx_t = $_POST['sgdt_mt_idx'];
    } else {
        $mt_idx_t = $_SESSION['_mt_idx'];
    }

    // 저장된 날짜가 있으면 사용, 없으면 현재 날짜 사용
    if ($_POST['sdate']) {
        $sdate = $_POST['sdate'];
    } else {
        $sdate = date('Y-m-d');
    }

    if ($_POST['week_chk'] == 'Y') {
        $end_cnt = '7';
    } else {
        $end_cnt = '42';

        $sdate = date('Y-m-01', strtotime($sdate));
    }

    $get_first_date_week = date('w', make_mktime($sdate));
    $get_first_date = date('Y-m-d', strtotime($sdate . " -" . $get_first_date_week . "days"));

    if ($_POST['sgdt_mt_idx']) {
        $mt_idx_t = $_POST['sgdt_mt_idx'];
    } else {
        $mt_idx_t = $_SESSION['_mt_idx'];
    }

    $arr_data = array();

    if ($sdate) {
        $_POST['start'] = date('Y-m-01', make_mktime($sdate));
        $_POST['end'] = date('Y-m-t', make_mktime($sdate));
    }

    //내가 등록한 일정
    unset($list);
    $DB->where('mt_idx', $mt_idx_t);
    $DB->where("( sst_sdate >= '" . $_POST['start'] . " 00:00:00' and sst_edate <= '" . $_POST['end'] . " 23:59:59' )");
    $DB->where('sst_show', 'Y');
    $list = $DB->get('smap_schedule_t');

    if ($list) {
        foreach ($list as $row) {
            if ($row['sst_title']) {
                $cd = cal_remain_days2($row['sst_sdate'], $row['sst_edate']);

                if ($cd) {
                    for ($q = 0; $q < $cd; $q++) {
                        $sdate_t = date("Y-m-d", strtotime($row['sst_sdate'] . " +" . $q . " days"));
                        $arr_data[$sdate_t] = array(
                            'id' => $row['sst_idx'],
                            'start' => $sdate_t,
                            'end' => $row['sst_edate'],
                            'title' => $row['sst_title'],
                        );
                    }
                }
            }
        }
    }

    //나에게 등록된 일정
    $DB->where('mt_idx', $mt_idx_t);
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $DB->where('sgdt_show', 'Y');
    $row_sgdt = $DB->getone('smap_group_detail_t', 'GROUP_CONCAT(sgt_idx) as gc_sgt_idx, GROUP_CONCAT(sgdt_idx) as gc_sgdt_idx, sgdt_owner_chk, sgdt_leader_chk');

    if ($row_sgdt['gc_sgt_idx']) {
        unset($list);
        $DB->where("sgt_idx in (" . $row_sgdt['gc_sgt_idx'] . ")");
        $DB->where("sgdt_idx in (" . $row_sgdt['gc_sgdt_idx'] . ")");
        $DB->where(" ( sst_sdate >= '" . $_POST['start'] . " 00:00:00' and sst_edate <= '" . $_POST['end'] . " 23:59:59' )");
        $DB->where('sst_show', 'Y');
        $list = $DB->get('smap_schedule_t');

        if ($list) {
            foreach ($list as $row) {
                if ($row['sst_title']) {
                    $cd = cal_remain_days2($row['sst_sdate'], $row['sst_edate']);

                    if ($cd) {
                        for ($q = 0; $q < $cd; $q++) {
                            $sdate_t = date("Y-m-d", strtotime($row['sst_sdate'] . " +" . $q . " days"));
                            $arr_data[$sdate_t] = array(
                                'id' => $row['sst_idx'],
                                'start' => $sdate_t,
                                'end' => $row['sst_edate'],
                                'title' => $row['sst_title'],
                            );
                        }
                    }
                }
            }
        }
    }
    // 내가 오너라면 모든이들의 일정 확인한번 더 하기
    if ($row_sgdt == 'Y') {
        unset($list);
        $DB->where("sgt_idx in (" . $row_sgdt['gc_sgt_idx'] . ")");
        $DB->where(" ( sst_sdate >= '" . $_POST['start'] . " 00:00:00' and sst_edate <= '" . $_POST['end'] . " 23:59:59' )");
        $DB->where('sst_show', 'Y');
        $list = $DB->get('smap_schedule_t');

        if ($list) {
            foreach ($list as $row) {
                if ($row['sst_title']) {
                    $cd = cal_remain_days2($row['sst_sdate'], $row['sst_edate']);

                    if ($cd) {
                        for ($q = 0; $q < $cd; $q++) {
                            $sdate_t = date("Y-m-d", strtotime($row['sst_sdate'] . " +" . $q . " days"));
                            $arr_data[$sdate_t] = array(
                                'id' => $row['sst_idx'],
                                'start' => $sdate_t,
                                'end' => $row['sst_edate'],
                                'title' => $row['sst_title'],
                            );
                        }
                    }
                }
            }
        }
    }

    ?>

    <form>
        <div class="date_conent">
            <div class="cld_content">
                <div class="cld_body fs_15 fw_500">
                    <ul>
                        <?php
                        for ($d = 0; $d < $end_cnt; $d++) {
                            $c_id = date("Y-m-d", strtotime($get_first_date . " +" . $d . "days"));
                            $c_id2 = date("j", strtotime(date($c_id))); //일
                            $c_id3 = date("w", strtotime(date($c_id))); //요일
                            $c_id4 = date("n", strtotime(date($c_id))); //월
                            $c_id5 = date("n", strtotime(date($sdate))); //월

                            if ($c_id3 == '0') {
                                $week_c = ' sun';
                            } elseif ($c_id3 == '6') {
                                $week_c = ' sat';
                            } else {
                                $week_c = '';
                            }

                            // 오늘 날짜인 경우 today 클래스 추가
                            if ($c_id == date("Y-m-d")) {
                                $today_c = ' today';
                            } else {
                                $today_c = '';
                            }

                            if ($arr_data[$c_id]) {
                                $schdl_c = ' schdl';
                            } else {
                                $schdl_c = '';
                            }

                            if ($c_id4 == $c_id5) {
                                echo '<li onclick="f_day_click(\'' . $c_id . '\');"><div id="calendar_' . $c_id . '" class="c_id ' . $week_c . $today_c . $schdl_c . '"><span>' . $c_id2 . '</span></div></li>';
                            } else {
                                echo '<li onclick="f_day_click(\'' . $c_id . '\');"><div id="calendar_' . $c_id . '" class="c_id lastday"><span>' . $c_id2 . '</span></div></li>';
                            }
                        }
                        ?>
                    </ul>
                </div>
            </div>
        </div>
    </form>

    <script>
        // 페이지 로드 시 저장된 날짜 확인 및 적용
        document.addEventListener('DOMContentLoaded', function() {
            const savedDate = localStorage.getItem('selectedDate');
            if (savedDate) {
                const calendarElement = document.getElementById('calendar_' + savedDate);
                if (calendarElement) {
                    // 기존 선택된 날짜의 스타일 제거
                    const selectedElements = document.querySelectorAll('.c_id.selected, .c_id.active');
                    selectedElements.forEach(el => {
                        el.classList.remove('selected');
                        el.classList.remove('active');
                    });
                    
                    // 저장된 날짜에 선택 스타일 적용
                    calendarElement.classList.add('selected');
                    calendarElement.classList.add('active');
                    
                    // 일정 데이터 로드
                    loadScheduleData(savedDate);
                }
            }
        });

        // 날짜 클릭 시 저장 및 스타일 적용
        function f_day_click(date) {
            // localStorage에 선택된 날짜 저장
            localStorage.setItem('selectedDate', date);
            
            // 기존 선택된 날짜의 스타일 제거
            const selectedElements = document.querySelectorAll('.c_id.selected, .c_id.active');
            selectedElements.forEach(el => {
                el.classList.remove('selected');
                el.classList.remove('active');
            });
            
            // 새로 선택된 날짜에 스타일 적용
            const calendarElement = document.getElementById('calendar_' + date);
            if (calendarElement) {
                calendarElement.classList.add('selected');
                calendarElement.classList.add('active');
            }

            // AJAX를 통한 일정 목록 조회
            $.ajax({
                type: "POST",
                url: "./schedule_update.php",
                data: {
                    act: "schedule_list",
                    event_start_date: date
                },
                success: function(response) {
                    $("#schedule_list").html(response);
                    schedule_map_list(date);
                    
                    // 날짜 선택 상태 유지
                    $('.c_id').removeClass('selected active');
                    $('#calendar_' + date).addClass('selected active');
                }
            });
        }
    </script>
<? } elseif ($_POST['act'] == "group_member_list") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    $sgt_cnt = f_get_owner_cnt($_SESSION['_mt_idx']); // 오너인 그룹수
    $DB->where('sgdt_idx', $_POST['group_sgdt_idx']);
    $sgdt_row = $DB->getone('smap_group_detail_t');

    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $row_sgdt = $DB->getone('smap_group_detail_t', 'GROUP_CONCAT(sgt_idx) as gc_sgt_idx');

    unset($list_sgt);
    $DB->where("sgt_idx in (" . $row_sgdt['gc_sgt_idx'] . ")");
    $DB->where('sgt_show', 'Y');
    $DB->orderBy("sgt_udate", "desc");
    $DB->orderBy("sgt_idx", "asc");
    $list_sgt = $DB->get('smap_group_t');

    $DB->where('sgdt_idx', $sgdt_row['sgdt_idx']);
    $DB->where('sgdt_show', 'Y');
    $sgdt_row = $DB->getone('smap_group_detail_t');

    $mllt_row = get_member_location_log_t_info($sgdt_row['mt_idx']);

?>

    <!-- 프로필 tab_scroll scroll_bar_x -->
    <div class="mem_wrap mem_swiper">
        <div class="swiper-wrapper d-flex">
            <!-- 사용자 본인 -->
            <!-- <div class="swiper-slide checks mem_box">
                <label>
                    <input type="radio" name="rd2" <?= $sgdt_row['sgdt_owner_chk'] == 'Y' ? 'checked' : '' ?> onclick="mem_schedule(<?= $sgdt_row['sgdt_idx'] ?>, <?= $mllt_row['mlt_lat'] ?>, <?= $mllt_row['mlt_long'] ?>);">
                    <div class="prd_img mx-auto">
                        <div class="rect_square rounded_14">
                            <img src="<?= $_SESSION['_mt_file1'] ?>" onerror="this.src='<?= $ct_no_profile_img_url ?>'" alt="프로필이미지" />
                        </div>
                    </div>
                    <p class="fs_12 fw_400 text-center mt-2 line_h1_2 line2_text text_dynamic"><?= $_SESSION['_mt_nickname'] ? $_SESSION['_mt_nickname'] : $_SESSION['_mt_name'] ?></p>
                </label>
            </div> -->

            <?php
            if ($list_sgt) {
                foreach ($list_sgt as $row_sgt) {
                    $member_cnt_t = get_group_member_cnt($row_sgt['sgt_idx']);
                    unset($list_sgdt);
                    $list_sgdt = get_sgdt_member_lists($row_sgt['sgt_idx']);
                    $invite_cnt = get_group_invite_cnt($row_sgt['sgt_idx']);
                    if ($invite_cnt || $list_sgdt['data']) {
                        if ($list_sgdt['data']) {
                            foreach ($list_sgdt['data'] as $key => $val) {
            ?>
                                <div class="swiper-slide checks mem_box">
                                    <label>
                                        <input type="radio" name="rd2" <?= $val['sgdt_owner_chk'] == 'Y' ? 'checked' : '' ?> onclick="mem_schedule(<?= $val['sgdt_idx'] ?>, <?= $val['mt_lat'] ?>, <?= $val['mt_long'] ?>);">
                                        <div class="prd_img mx-auto">
                                            <div class="rect_square rounded_14">
                                                <img src="<?= $val['mt_file1_url'] ?>" alt="프로필이미지" onerror="this.src='<?= $ct_no_profile_img_url ?>'" />
                                            </div>
                                        </div>
                                        <p class="fs_12 fw_400 text-center mt-2 line_h1_2 line2_text text_dynamic"><?= $val['mt_nickname'] ? $val['mt_nickname'] : $val['mt_name'] ?></p>
                                    </label>
                                </div>
            <?php
                            }
                        }
                    }
                }
            }
            ?>

            <!-- 그룹원 추가 -->
            <?php if ($sgt_cnt > 0) { ?>
                <div class="swiper-slide mem_box add_mem_box" onclick="location.href='./group'">
                    <button class="btn mem_add">
                        <i class="xi-plus-min fs_20"></i>
                    </button>
                    <p class="fs_12 fw_400 text-center mt-2 line_h1_4 text_dynamic"><?= $translations['txt_invite_group_members'] ?></p>
                </div>
            <?php } else { ?>
                <div class="swiper-slide mem_box add_mem_box" style="visibility: hidden;">
                    <button class="btn mem_add">
                        <i class="xi-plus-min fs_20"></i>
                    </button>
                    <p class="fs_12 fw_400 text-center mt-2 line_h1_4 text_dynamic"><?= $translations['txt_invite_group_members'] ?></p>
                </div>
            <?php } ?>
        </div>
    </div>

    <script>
        // Swiper 초기화
        var mem_swiper = new Swiper('.mem_swiper', {
            slidesPerView: 'auto',
            spaceBetween: 12,
        });
    </script>


    <? } elseif ($_POST['act'] == "member_schedule_list") {
    if (!isset($_SESSION['_mt_idx']) || empty($_SESSION['_mt_idx'])) {
        echo "<script>alert('" . $_SESSION['msg'] . "');location.replace('/login.php');</script>";
        exit;
    }

    if (empty($_SESSION['_mt_idx'])) {
        p_alert($translations['txt_login_required'], './login', '');
        exit;
    }

    if (!isset($DB) || !$DB) {
        echo json_encode(['error' => '데이터베이스 연결 오류']);
        exit;
    }

    function getBatteryInfo($percentage)
    {
        if ($percentage >= 80) {
            return ['color' => '#4CAF50', 'image' => './img/battery_green.png', 'percentage' => $percentage];
        } elseif ($percentage >= 50) {
            return ['color' => '#FFC107', 'image' => './img/battery_yellow.png', 'percentage' => $percentage];
        } else {
            return ['color' => '#FF204E', 'image' => './img/battery_red.png', 'percentage' => $percentage];
        }
    }

    function getSchedules($sgdt_idx, $event_start_date, $mt_idx)
    {
        global $DB;

        //나의 일정
        unset($list);
        if ($sgdt_idx != '') {
            $DB->where('sgdt_idx', $sgdt_idx);
        } else {
            $DB->where('mt_idx', $mt_idx);
        }
        $DB->where(" ( sst_sdate <= '" . $event_start_date . " 23:59:59' and sst_edate >= '" . $event_start_date . " 00:00:00' )");
        $DB->where('sst_show', 'Y');
        $DB->orderBy('sst_sdate', 'ASC');
        $list = $DB->get('smap_schedule_t');

        return $list;
    }

    if ($_POST['sgdt_idx'] != '' && $_POST['sgdt_idx'] != 'undefined') {
        // 그룹 상세 정보 조회
        $DB->where('sgdt_idx', $_POST['sgdt_idx']);
        $DB->where('sgdt_show', 'Y');
        $DB->where('sgdt_discharge', 'N');
        $DB->where('sgdt_exit', 'N');
        $sgdt_row = $DB->getone('smap_group_detail_t');

        // logToFile("[" . date("Y-m-d H:i:s") . "] sgdt_row: " . print_r($sgdt_row, true));

        if (!$sgdt_row) {
            echo json_encode(['error' => '그룹 상세 정보를 찾을 수 없습니다.']);
            exit;
        }

        // 그룹 멤버 정보 조회 - 일반 멤버가 먼저, 오너/리더가 나중에 오도록 수정
        $query = "SELECT * FROM smap_group_detail_t 
                  WHERE sgt_idx = " . $sgdt_row['sgt_idx'] . " 
                  AND sgdt_show = 'Y' 
                  AND sgdt_discharge = 'N' 
                  AND sgdt_exit = 'N' 
                  ORDER BY 
                    CASE 
                        WHEN sgdt_owner_chk = 'Y' OR sgdt_leader_chk = 'Y' THEN 1 
                        ELSE 0 
                    END ASC,
                    sgdt_wdate ASC";
        $sgdt_list = $DB->rawQuery($query);

        // logToFile("[" . date("Y-m-d H:i:s") . "] sgdt_list: " . print_r($sgdt_list, true));
    }
    $owner_count = 0;
    if ($sgdt_list) {
        foreach ($sgdt_list as $member) {
            if ($member['sgdt_owner_chk'] == 'Y') {
                $owner_count++;
            }
        }
    }
    $result = ['result' => 'N', 'sgdt_idx' => $sgdt_row['sgdt_idx'], 'members' => [], 'owner_count' => $owner_count, 'sgt_cnt' => f_get_owner_cnt($_SESSION['_mt_idx'])]; // 결과를 저장할 배열, result 값 초기화


    // 캐시 설정 (예: Redis 사용)
    if (class_exists('Redis')) {
        $redis = new Redis();
        $redis->connect('127.0.0.1', 6379);
    } else {
        // Redis가 없는 경우 대체 로직
        // 이 위치에 필요한 대체 로직을 구현
    }

    // 캐시 키 생성을 위한 함수
    function getCacheKey($mt_idx)
    {
        return "location_info:{$mt_idx}";
    }

    // 배치로 모든 멤버의 위치 정보를 가져오는 함수
    function batchGetLocationInfo($DB, $member_indices)
    {
        $query = "SELECT mlt.mt_idx, mlt.mlt_battery, mlt.mlt_speed, mlt.mlt_lat, mlt.mlt_long, mlt.mlt_gps_time
                FROM member_location_log_t mlt
                INNER JOIN (
                    SELECT mt_idx, MAX(mlt_gps_time) as max_time
                    FROM member_location_log_t
                    WHERE mt_idx IN (" . implode(',', $member_indices) . ")
                    GROUP BY mt_idx
                ) latest ON mlt.mt_idx = latest.mt_idx AND mlt.mlt_gps_time = latest.max_time";

        return $DB->rawQuery($query);
    }

    if ($sgdt_list && $sgdt_list != '') {
        $member_indices = array_column($sgdt_list, 'mt_idx');
        $cached_locations = [];
        $uncached_indices = [];

        // 캐시에서 위치 정보 확인
        foreach ($member_indices as $mt_idx) {
            $cache_key = getCacheKey($mt_idx);
            $cached_data = $redis->get($cache_key);
            if ($cached_data) {
                $cached_locations[$mt_idx] = json_decode($cached_data, true);
            } else {
                $uncached_indices[] = $mt_idx;
            }
        }

        // 캐시되지 않은 위치 정보 배치로 가져오기
        if (!empty($uncached_indices)) {
            $fresh_locations = batchGetLocationInfo($DB, $uncached_indices);
            foreach ($fresh_locations as $location) {
                $mt_idx = $location['mt_idx'];
                $cache_key = getCacheKey($mt_idx);
                $redis->setex($cache_key, 300, json_encode($location)); // 5분 동안 캐시
                $cached_locations[$mt_idx] = $location;
            }
        }

        foreach ($sgdt_list as $sgdt_member) {
            // 멤버 언어 업데이트
            if ($_SESSION['mt_idx'] == $sgdt_member['mt_idx']) {
                $DB->where('mt_idx', $sgdt_member['mt_idx']);
                $DB->update('member_t', ['mt_lang' => $_POST['mt_lang']]);
            }

            // 멤버 정보 조회
            $DB->where('mt_idx', $sgdt_member['mt_idx']);
            $member_info = $DB->getone('member_t', 'mt_idx, mt_name, mt_nickname, mt_sido, mt_gu, mt_dong, mt_file1, mt_lat, mt_long, mt_lang');
            $member_info['my_profile'] = $member_info['mt_file1'] == "" ? $ct_no_img_url : get_image_url($member_info['mt_file1']);
            $member_info['sgdt_idx'] = $sgdt_member['sgdt_idx'];
            $member_info['sgt_idx'] = $sgdt_member['sgt_idx'];

            // logToFile("[" . date("Y-m-d H:i:s") . "] member_info: " . print_r($member_info, true));

            // 캐시된 위치 정보 사용
            $location_info = $cached_locations[$sgdt_member['mt_idx']] ?? null;

            // 위치 정보가 없는 경우 빈 배열로 초기화
            if (!$location_info) {
                $DB->where('mt_idx', $sgdt_member['mt_idx']);
                $DB->orderby('mlt_gps_time', 'desc');
                $location_info = $DB->getone('member_location_log_t');
            }
            $member_info['mt_lat'] = $location_info['mlt_lat'];
            $member_info['mt_long'] = $location_info['mlt_long'];
            $member_info['mt_gps_time'] = $location_info['mlt_gps_time'];

            // 배터리 정보 조회
            $battery_info = getBatteryInfo(intval($location_info['mlt_battery'] ?? 0));

            // 일정 정보 조회
            $schedules = getSchedules($sgdt_member['sgdt_idx'], $_POST['event_start_date'], $sgdt_member['mt_idx']);

            // 경로 데이터 조회
            $arr_sst_idx = get_schedule_main($sgdt_member['sgdt_idx'], $_POST['event_start_date'], $sgdt_member['mt_idx']);
            $schedule_count = count($arr_sst_idx);
            $arr_sst_date = get_schedule_date($sgdt_member['sgdt_idx'], $_POST['event_start_date'], $sgdt_member['mt_idx']);

            // result_data['members'] 배열 초기화 (sgdt_idx를 키로 사용)
            $result['members'][$sgdt_member['sgdt_idx']] = [
                'result' => 'N',
                'sllt_json_text' => null,
                'sllt_json_walk' => null,
                'member_info' => $member_info,
                'location_info' => $location_info,
                'battery_info' => $battery_info,
                'schedules' => $schedules,
            ];

            if (!empty($arr_sst_date)) {
                $latest_date = max($arr_sst_date);
                $wdate = date('Y-m-d');
                $DB->where('sgdt_idx', $sgdt_member['sgdt_idx']);
                $DB->where('sllt_date', $wdate);
                $DB->orderby('sllt_wdate', 'desc');
                $sllt_row = $DB->getone('smap_loadpath_log_t');

                $result['result'] = 'Y'; // 전체 결과도 Y로 변경

                // logToFile($sllt_row['sllt_schedule_count'] . ' ' . count($arr_sst_date));
                if ($sllt_row && $sllt_row['sllt_schedule_count'] === count($arr_sst_date) - 1) {
                    $result['members'][$sgdt_member['sgdt_idx']]['result'] = 'Y'; // 멤버별 결과도 Y로 변경
                    $result['members'][$sgdt_member['sgdt_idx']]['sllt_json_text'] = $sllt_row['sllt_json_text'];
                    $result['members'][$sgdt_member['sgdt_idx']]['sllt_json_walk'] = $sllt_row['sllt_json_walk'];
                } else {
                    $result['members'][$sgdt_member['sgdt_idx']]['result'] = 'N'; // 멤버별 결과도 N로 변경
                    $result['members'][$sgdt_member['sgdt_idx']]['sllt_json_text'] = null;
                    $result['members'][$sgdt_member['sgdt_idx']]['sllt_json_walk'] = null;
                }
            }

            if ($member_info) {
                $result['result'] = 'Y'; // 전체 결과도 Y로 변경
            }
        }
    } else {
        $DB->where('mt_idx', $_SESSION['_mt_idx']);
        $member_info = $DB->getone('member_t', 'mt_idx, mt_name, mt_sido, mt_gu, mt_dong, mt_file1, mt_lat, mt_long');
        $member_info['sgdt_idx'] = '';

        // 위치 정보 (캐시 사용)
        $cache_key = getCacheKey($_SESSION['_mt_idx']);
        $cached_location = $redis->get($cache_key);
        if ($cached_location) {
            $location_info = json_decode($cached_location, true);
        } else {
            $DB->where('mt_idx', $_SESSION['_mt_idx']);
            $DB->orderby('mlt_gps_time', 'desc');
            $location_info = $DB->getone('member_location_log_t', 'mlt_battery, mlt_speed, mlt_lat, mlt_long, mlt_gps_time');
            if ($location_info) {
                $redis->setex($cache_key, 300, json_encode($location_info)); // 5분 동안 캐시
            }
        }

        // 배터리 정보
        $battery_info = getBatteryInfo(intval($location_info['mlt_battery'] ?? 0));

        // 일정 정보
        $schedules = getSchedules($_POST['sgdt_idx'], $_POST['event_start_date'], $_SESSION['_mt_idx']);

        // 위치 정보가 없는 경우 빈 배열로 초기화
        if (!$location_info) {
            $location_info = [
                'mlt_battery' => 0,
                'mlt_speed' => 0,
                'mlt_lat' => $member_info['mt_lat'],
                'mlt_long' => $member_info['mt_long'],
                'mlt_gps_time' => $member_info['mt_gps_time']
            ];
        }
        $result['members'][$_SESSION['_mt_idx']] = [
            'result' => 'N',
            'sllt_json_text' => null,
            'sllt_json_walk' => null,
            'member_info' => $member_info,
            'location_info' => $location_info,
            'battery_info' => $battery_info,
            'schedules' => $schedules,
        ];
        if ($member_info) {
            $result['result'] = 'Y'; // 전체 결과도 Y로 변경
            $result['members'][$_SESSION['_mt_idx']]['member_info']['mt_lat'] = $location_info['mlt_lat'] == "" ? $member_info['mt_lat'] : $location_info['mlt_lat'];
            $result['members'][$_SESSION['_mt_idx']]['member_info']['mt_long'] = $location_info['mlt_long'] == "" ? $member_info['mt_long'] :  $location_info['mlt_long'];
            $result['members'][$_SESSION['_mt_idx']]['member_info']['my_profile'] = $member_info['mt_file1'] == "" ? $ct_no_img_url : get_image_url($member_info['mt_file1']);
        }
    }



    // logToFile("result: " . print_r($result, true));

    // JSON으로 데이터 반환
    echo json_encode($result);
    exit;
} elseif ($_POST['act'] == "member_location_reload") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    if ($_POST['sgdt_idx']) {
        $DB->where('sgdt_idx', $_POST['sgdt_idx']);
        $sgdt_row = $DB->getone('smap_group_detail_t');
        if ($sgdt_row) {
            $DB->where('mt_idx', $sgdt_row['mt_idx']);
            $mem_row = $DB->getone('member_t');

            $DB->where('mt_idx', $mem_row['mt_idx']);
            $DB->orderby('mlt_gps_time', 'desc');
            $mt_location_info = $DB->getone('member_location_log_t');

            $battery_percentage = isset($mt_location_info['mlt_battery']) ? intval($mt_location_info['mlt_battery']) : 0;
            $battery_color = '';

            if ($battery_percentage >= 80) {
                $battery_color = '#4CAF50'; // 초록색 계열
                $battery_image = './img/battery_green.png';
            } elseif ($battery_percentage >= 50) {
                $battery_color = '#FFC107'; // 노란색 계열
                $battery_image = './img/battery_yellow.png';
            } else {
                $battery_color = '#FF204E'; // 빨간색 계열
                $battery_image = './img/battery_red.png';
            }

            function generateAddress($mem_row)
            {
                $components = [
                    $mem_row['mem_sido'],
                    $mem_row['mt_gu'],
                    $mem_row['mt_dong']
                ];

                $address = '';
                $seen = [];

                foreach ($components as $component) {
                    $parts = explode(' ', trim($component));
                    foreach ($parts as $part) {
                        if (!empty($part) && !in_array($part, $seen)) {
                            $address .= $part . ' ';
                            $seen[] = $part;
                        }
                    }
                }

                $address = rtrim($address);  // 마지막 공백 제거

                return $address;
            }

            // 사용 예시
            $mem_row = [
                'mem_sido' => $mem_row['mem_sido'],
                'mt_gu' => $mem_row['mt_gu'],
                'mt_dong' => $mem_row['mt_dong']
            ];

            $address = generateAddress($mem_row);
    ?>
            <div class="border-bottom  pb-3">
                <div class="task_header_tit">
                    <p class="fs_16 fw_600 line_h1_2 mr-3"><?= $translations['txt_current_location'] ?></p>
                    <div class="d-flex align-items-center justify-content-end">
                        <!-- <p class="move_txt fs_13 mr-3"><span class="mr-1"><? if ($mt_location_info['mlt_speed'] > 1) { ?>이동중</span> <?= round($mt_location_info['mlt_speed']) ?>km/h<? } ?></p> -->
                        <p class="move_txt fs_13 mr-3"><span class="mr-1"><? if ($mt_location_info['mlt_speed'] > 1) { ?><?= $translations['txt_moving'] ?></span><? } ?></p>
                        <!-- <p class="d-flex bettery_txt fs_13"><span class="d-flex align-items-center flex-shrink-0 mr-2"><img src="./img/battery.png?v=20240404" width="14px" class="battery_img" alt="베터리시용량"></span> <?= $mt_location_info['mlt_battery'] ?>%</p> -->
                        <p class="d-flex fs_13">
                            <span class="d-flex align-items-center flex-shrink-0 mr-2">
                                <img src="<?= $battery_image; ?>" width="14px" class="battery_img" alt="베터리시용량">
                            </span>
                            <span style="color: <?= $battery_color; ?>"><?= $battery_percentage; ?>%</span>
                        </p>
                    </div>
                </div>
                <p class="fs_14 fw_500 text_light_gray text_dynamic line_h1_3 mt-2"><?= $address ?></p>
            </div>
        <?php
        }
    } else {
        $DB->where('mt_idx', $_SESSION['_mt_idx']);
        $mem_row = $DB->getone('member_t');

        $DB->where('mt_idx', $mem_row['mt_idx']);
        $DB->orderby('mlt_gps_time', 'desc');
        $mt_location_info = $DB->getone('member_location_log_t');

        $battery_percentage = intval($mt_location_info['mlt_battery']);
        $battery_color = '';

        if ($battery_percentage >= 80) {
            $battery_color = '#4CAF50'; // 초록색 계열
            $battery_image = './img/battery_green.png';
        } elseif ($battery_percentage >= 50) {
            $battery_color = '#FFC107'; // 노란색 계열
            $battery_image = './img/battery_yellow.png';
        } else {
            $battery_color = '#FF204E'; // 빨간색 계열
            $battery_image = './img/battery_red.png';
        }
        ?>
        <div class="border-bottom  pb-3">
            <div class="task_header_tit">
                <p class="fs_16 fw_600 line_h1_2 mr-3"><?= $translations['txt_current_location'] ?></p>
                <div class="d-flex align-items-center justify-content-end">
                    <!-- <p class="move_txt fs_13 mr-3"><span class="mr-1"><? if ($mt_location_info['mlt_speed'] > 1) { ?>이동중</span> <?= round($mt_location_info['mlt_speed']) ?>km/h<? } ?></p> -->
                    <p class="move_txt fs_13 mr-3"><span class="mr-1"><? if ($mt_location_info['mlt_speed'] > 1) { ?><?= $translations['txt_moving'] ?></span><? } ?></p>
                    <!-- <p class="d-flex bettery_txt fs_13"><span class="d-flex align-items-center flex-shrink-0 mr-2"><img src="./img/battery.png?v=20240404" width="14px" class="battery_img" alt="베터리시용량"></span> <?= $mt_location_info['mlt_battery'] ?>%</p> -->
                    <p class="d-flex fs_13">
                        <span class="d-flex align-items-center flex-shrink-0 mr-2">
                            <img src="<?= $battery_image; ?>" width="14px" class="battery_img" alt="베터리시용량">
                        </span>
                        <span style="color: <?= $battery_color; ?>"><?= $battery_percentage; ?>%</span>
                    </p>
                </div>
            </div>
            <p class="fs_14 fw_500 text_light_gray text_dynamic line_h1_3 mt-2"><?= $mem_row['mt_sido'] . ' ' . $mem_row['mt_gu'] . ' ' . $mem_row['mt_dong'] ?></p>
        </div>
<?php
    }
} elseif ($_POST['act'] == "schedule_map_list") {
    define('CACHE_EXPIRE_TIME', 120); // 2분
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    $cache_key = "schedule_map_list_" . $_POST['sgdt_idx'] . "_" . $_SESSION['_mt_idx'];
    $cached_data = CacheUtil::get($cache_key);
    if ($cached_data) {
        echo json_encode($cached_data);
        exit;
    }

    // 함수 정의: 그룹 상세 정보 조회
    function get_group_detail($sgdt_idx)
    {
        global $DB;
        $DB->where('sgdt_idx', $sgdt_idx);
        $DB->where('sgdt_discharge', 'N');
        $DB->where('sgdt_exit', 'N');
        $DB->where('sgdt_show', 'Y');
        return $DB->getone('smap_group_detail_t');
    }

    // 함수 정: 그룹원 리스트 조회
    function get_group_members($sgt_idx)
    {
        global $DB;
        $DB->where('sgt_idx', $sgt_idx);
        $DB->where('sgdt_show', 'Y');
        $DB->where('sgdt_discharge', 'N');
        $DB->where('sgdt_exit', 'N');
        return $DB->get('smap_group_detail_t');
    }

    // 함수 정의: 회원 데이터 조회 및 캐싱
    function get_member_data($mt_idx)
    {
        global $DB, $ct_no_img_url;
        $cache_key = "member_data_" . $mt_idx;
        $cached_data = CacheUtil::get($cache_key);

        if ($cached_data) {
            $DB->where('mt_idx', $mt_idx);
            $DB->where('mt_update_dt', $cached_data['last_update'], '>');
            $updated = $DB->getOne('member_t', 'COUNT(*) as count');
            if ($updated['count'] == 0) {
                return $cached_data;
            }
        }

        $DB->where('mt_idx', $mt_idx);
        $mem_row = $DB->getone('member_t');
        $DB->where('mt_idx', $mt_idx);
        $DB->orderby('mlt_gps_time', 'desc');
        $mt_location_info = $DB->getone('member_location_log_t');

        $current_time = date('Y-m-d H:i:s');
        $member_data = [
            "lat" => $mt_location_info['mlt_lat'] ?? $mem_row['mt_lat'],
            "long" => $mt_location_info['mlt_long'] ?? $mem_row['mt_long'],
            "profile" => $mem_row['mt_file1'] ? get_image_url($mem_row['mt_file1']) : $ct_no_img_url,
            "last_update" => $current_time
        ];

        $DB->where('mt_idx', $mt_idx);
        $DB->update('member_t', ['mt_update_dt' => $current_time]);
        CacheUtil::set($cache_key, $member_data, 60); // 1분 캐시
        return $member_data;
    }

    $sgdt_row = get_group_detail($_POST['sgdt_idx']);
    $result_data = [];

    if ($sgdt_row) {
        $my_data = get_member_data($sgdt_row['mt_idx']);
    } else {
        $my_data = get_member_data($_SESSION['_mt_idx']);
    }

    $result_data = [
        "mt_lat" => $my_data['lat'],
        "mt_long" => $my_data['long'],
        "my_profile" => $my_data['profile'],
    ];

    $sgt_cnt = f_get_owner_cnt($_SESSION['_mt_idx']);
    $sgdt_leader_cnt = f_get_leader_cnt($_SESSION['_mt_idx']);
    if ($sgt_cnt > 0 || $sgdt_leader_cnt > 0) {
        $sgdt_list = get_group_members($sgdt_row['sgt_idx']);
        if ($sgdt_list) {
            $profile_count = 1;
            foreach ($sgdt_list as $sgdtg_row) {
                if ($sgdtg_row['sgdt_idx'] == $sgdt_row['sgdt_idx']) continue;

                $member_data = get_member_data($sgdtg_row['mt_idx']);
                $result_data["profilemarkerLat_$profile_count"] = $member_data['lat'];
                $result_data["profilemarkerLong_$profile_count"] = $member_data['long'];
                $result_data["profilemarkerImg_$profile_count"] = $member_data['profile'];
                $profile_count++;
            }
            $result_data['profile_count'] = $profile_count - 1;
        }
    }

    $arr_sst_idx = get_schedule_main($_POST['sgdt_idx'], $_POST['event_start_date'], $sgdt_row['mt_idx']);
    $cnt = count($arr_sst_idx);
    if ($cnt < 1) {
        $result_data['schedule_chk'] = 'N';
    } else {
        $arr_sst_idx_im = implode(',', $arr_sst_idx);
        $DB->where("sst_idx IN ($arr_sst_idx_im)");
        $DB->where('sst_show', 'Y');
        $DB->orderBy("sst_all_day", "asc");
        $DB->orderBy("sst_sdate", "asc");
        $DB->orderBy("sst_edate", "asc");
        $list_sst = $DB->get('smap_schedule_t');

        if ($list_sst) {
            $count = 1;
            $current_date = date('Y-m-d H:i:s');
            $color_sets = [
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

            $random_set = $color_sets[array_rand($color_sets)];
            $color1 = $random_set[0];
            $color2 = $random_set[1];

            foreach ($list_sst as $row_sst_a) {
                $mt_info = get_member_t_info($row_sst_a['mt_idx']);
                $mt_file1_url = get_image_url($mt_info['mt_file1']);

                $sst_sdate_e1 = get_date_ttime($row_sst_a['sst_sdate']);
                $sst_sdate_e2 = get_date_ttime($row_sst_a['sst_edate']);
                $sst_all_day_t = ($row_sst_a['sst_all_day'] == 'Y') ? $translations['all_day'] : "$sst_sdate_e1 ~ $sst_sdate_e2";

                $status = ($row_sst_a['sst_all_day'] == 'Y' || ($current_date >= $row_sst_a['sst_sdate'] && $current_date <= $row_sst_a['sst_edate'])) ? 'point_ing' : (($current_date >= $row_sst_a['sst_edate']) ? 'point_done' : 'point_gonna');
                $point_class = ($status == 'point_ing') ? 'point2' : (($status == 'point_done') ? 'point1' : 'point3');

                $content = <<<HTML
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
                    color: $color1;
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
                    color: $color2;
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
                <div class="point_wrap {$point_class}">
                    <button type="button" class="btn point {$status}">
                        <span class="point_inner">
                            <span class="point_txt">{$count}</span>
                        </span>
                    </button>
                    <div class="infobox5 rounded_04 px_08 py_03 on">
                        <span class="title">{$row_sst_a['sst_title']}</span>
                        <div class="date-wrapper">
                            <span class="date">S: {$sst_sdate_e1}</span>
                            <span class="date">E: {$sst_sdate_e2}</span>
                        </div>
                    </div>
                </div>
                HTML;

                $result_data["markerLat_$count"] = $row_sst_a['sst_location_lat'];
                $result_data["markerLong_$count"] = $row_sst_a['sst_location_long'];
                $result_data["markerContent_$count"] = $content;
                $result_data["markerStatus_$count"] = $status;

                $result_data["markerPointClass_$count"] = $point_class;
                $result_data["markerPointSstTitle_$count"] = $row_sst_a['sst_title'];
                $result_data["markerPointSstSdateE1_$count"] = $sst_sdate_e1;
                $result_data["markerPointSstSdateE2_$count"] = $sst_sdate_e2;
                $count++;
            }
        }
        $result_data['schedule_chk'] = 'Y';
        $result_data['count'] = $count - 1;
        $result_data['sgdt_idx'] = $_POST['sgdt_idx'];
    }

    CacheUtil::set($cache_key, $result_data, CACHE_EXPIRE_TIME);
    echo json_encode($result_data);
    exit;
} elseif ($_POST['act'] == "load_path_chk") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    // 회원구분
    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $mem_row = $DB->getone('member_t');
    if ($mem_row) {
        if ($mem_row['mt_level'] == 5) {
            $mt_type = 'Plus';
            $path_count_day = 10;
            $path_count_month = 300;
            $ad_count = 0;
        } else {
            $mt_type = 'Basic';
            $path_count_day = 2;
            $path_count_month = 60;

            // 무료회원일 경우 광고 카운트 확인하기
            $ad_row = get_ad_log_check($_SESSION['_mt_idx']);
            $ad_count = $ad_row['path_count'];
        }
        $wdate = date('Y-m-d');
        // 현재 날짜의 년도와 월을 가져옵니다.
        $start_date = date('Y-m-01');
        $end_date = date('Y-m-t');
        $result_data = array();
        $result_data['ad_count'] = $ad_count; // 오늘광고개수확인하기

        $DB->where('sgdt_idx', $_POST['sgdt_idx']);
        $DB->where('sgdt_show', 'Y');
        $DB->where('sgdt_discharge', 'N');
        $DB->where('sgdt_exit', 'N');
        $sgdt_row = $DB->getone('smap_group_detail_t');

        // 일정 카운트
        $arr_sst_idx = get_schedule_main($_POST['sgdt_idx'], $_POST['event_start_date'], $sgdt_row['mt_idx']);
        $schedule_count = count($arr_sst_idx);

        //나의 일정카운트 시 장소없는 것은 찾아내기
        $arr_sst_null = array();
        unset($list);
        $DB->where('sgdt_idx', $_POST['sgdt_idx']);
        $DB->where(" ( sst_sdate <= '" . $_POST['event_start_date'] . " 23:59:59' and sst_edate >= '" . $_POST['event_start_date'] . " 00:00:00' )");
        $DB->where(" ( sst_location_lat = 0 or sst_location_long = 0) ");
        $DB->where('sst_show', 'Y');
        $list = $DB->get('smap_schedule_t');

        if ($list) {
            foreach ($list as $row) {
                if ($row['sst_title']) {
                    $arr_sst_null[] = $row['sst_idx'];
                }
            }
        }
        $arr_sst_null = array_unique($arr_sst_null);
        $location_null_count = count($arr_sst_null);

        if ($location_null_count > 0) { // 장소값이 없는 부분이 있을 경우 리턴
            $result_data['result'] = 'NoLocation';
            $result_data['path_count_day'] = '0';
            $result_data['path_count_month'] = '0';
        } else {
            if ($schedule_count > 1) {
                // 월 카운트
                $DB->where('mt_idx', $_SESSION['_mt_idx']);
                // $DB->where('sgdt_idx', $_POST['sgdt_idx']);
                $DB->where('sllt_date', [$start_date, $end_date], 'BETWEEN', 'AND');
                $sllt_month_list = $DB->get('smap_loadpath_log_t');
                $month_count = count($sllt_month_list);
                // 일 카운트
                $DB->where('mt_idx', $_SESSION['_mt_idx']);
                // $DB->where('sgdt_idx', $_POST['sgdt_idx']);
                $DB->where('sllt_date', $wdate);
                $sllt_list = $DB->get('smap_loadpath_log_t');
                $sllt_count = count($sllt_list);
                if ($sllt_count < $path_count_day) {
                    $result_data['result'] = 'Y';
                    $result_data['path_type'] = $mt_type;
                    $result_data['path_count_day'] = $path_count_day - $sllt_count;
                    $result_data['path_count_month'] = $path_count_month - $month_count;
                } else {
                    $result_data['result'] = 'Y';
                    $result_data['path_type'] = $mt_type;
                    $result_data['path_count_day'] = '0';
                    $result_data['path_count_month'] = $path_count_month - $month_count;
                }
            } else {
                $result_data['result'] = 'Noschedule';
                $result_data['path_count_day'] = '0';
                $result_data['path_count_month'] = '0';
            }
        }
    } else {
        $result_data['result'] = 'N';
        $result_data['path_count_day'] = '0';
        $result_data['path_count_month'] = '0';
    }

    $rtn = json_encode($result_data);

    echo $rtn;
    exit;
} elseif ($_POST['act'] == "pedestrian_path_chk") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    // logToFile("pedestrian_path_chk start");
    // smap_group_detail_t에서 sgdt_idx를 통해서 그룹 sgt_idx를 찾는다.
    $DB->where('sgdt_idx', $_POST['sgdt_idx']);
    $DB->where('sgdt_show', 'Y');
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $sgdt_row = $DB->getone('smap_group_detail_t');

    // // logToFile("1");
    // sgt_idx로 그룹원들을 찾는다.
    $DB->where('sgt_idx', $sgdt_row['sgt_idx']);
    $DB->where('sgdt_show', 'Y');
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $sgdt_list = $DB->get('smap_group_detail_t');
    // // logToFile("2");
    $result_data = array();
    $result_data['result'] = 'N';

    foreach ($sgdt_list as $sgdt_member) {
        // 일정 카운트
        // logToFile($sgdt_member['sgdt_idx'] . ' / ' . $_POST['event_start_date'] . ' / ' . $sgdt_member['mt_idx']);
        $arr_sst_idx = get_schedule_main($sgdt_member['sgdt_idx'], $_POST['event_start_date'], $sgdt_member['mt_idx']);
        $schedule_count = count($arr_sst_idx);
        // // logToFile("schedule_count : " . $schedule_count);
        // 일정 등록일/수정일 배열
        $arr_sst_date = get_schedule_date($sgdt_member['sgdt_idx'], $_POST['event_start_date'], $sgdt_member['mt_idx']);
        // logToFile("arr_sst_date : " . print_r($arr_sst_date, true));
        // // logToFile("arr_sst_date_count : " . count($arr_sst_date));
        if ($arr_sst_date && $_POST['sgdt_idx'] == $sgdt_member['sgdt_idx']) {
            $latest_date = max($arr_sst_date); // 등록/수정일 중 가장 최근일자 뽑아오기
            $wdate = date('Y-m-d');

            // $DB->where('mt_idx', $sgdt_member['mt_idx']);
            $DB->where('sgdt_idx', $sgdt_member['sgdt_idx']);
            // $DB->where("sllt_wdate >= '" . $latest_date  . "'");
            $DB->where('sllt_date', $wdate);
            $DB->orderby('sllt_wdate', 'desc');
            $sllt_row = $DB->getone('smap_loadpath_log_t');
            // logToFile("sllt_row : " . print_r($sllt_row, true));

            if ($sllt_row && $sllt_row['sllt_schedule_count'] === count($arr_sst_date) - 1) {
                $result_data['result'] = 'Y'; // 경로 데이터 유무와 관계없이 result를 Y로 변경
                $result_data['mt_idx'] = $sllt_row['mt_idx'] ?? null; // sllt_row가 없으면 mt_idx는 null
                $result_data['members'][$sgdt_member['sgdt_idx']] = array(
                    'sllt_json_text' => $sllt_row['sllt_json_text'] ?? null, // sllt_row가 없으면 null
                    'sllt_json_walk' => $sllt_row['sllt_json_walk'] ?? null  // sllt_row가 없으면 null
                );
            } else {
                $result_data['result'] = 'N';
            }
        }
    }
    // logToFile("result_data : " . print_r($result_data, true));
    echo json_encode($result_data);
} elseif ($_POST['act'] == "loadpath_add") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    $DB->where('sgdt_idx', $_POST['sgdt_idx']);
    $DB->where('sgdt_show', 'Y');
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $sgdt_row = $DB->getone('smap_group_detail_t');

    // 일정 카운트
    $arr_sst_idx = get_schedule_main($_POST['sgdt_idx'], $_POST['event_start_date'], $sgdt_row['mt_idx']);
    $schedule_count = count($arr_sst_idx);
    $date = date('Y-m-d');
    unset($arr_query);
    $arr_query = array(
        "mt_idx" => $_SESSION['_mt_idx'],
        "sgdt_idx" => $_POST['sgdt_idx'],
        "sllt_json_text" => $_POST['sllt_json_text'],
        "sllt_json_walk" => $_POST['sllt_json_walk'],
        "sllt_schedule_count" => $schedule_count,
        "sllt_date" => $date,
        "sllt_wdate" => $DB->now(),
        "sllt_language" => $_POST['sllt_language'],
    );
    $DB->insert('smap_loadpath_log_t', $arr_query);

    echo 'Y';
} elseif ($_POST['act'] == "my_location_search") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    // 요청된 사용자 ID 유효성 검사
    $mt_idx = isset($_POST['mt_idx']) ? $_POST['mt_idx'] : null;
    if (!$mt_idx) {
        $result_data = array(
            'error' => true,
            'message' => 'Invalid member ID'
        );
        echo json_encode($result_data);
        exit;
    }

    // 1. 먼저 요청된 사용자의 최신 위치 로그 조회
    $DB->where('mt_idx', $mt_idx);
    $DB->orderby('mlt_gps_time', 'desc');
    $mllt_row = $DB->getone('member_location_log_t');
    
    // 2. 로그가 없으면 사용자 기본 정보 조회
    if (!$mllt_row['mlt_idx']) {
        $DB->where('mt_idx', $mt_idx);
        $member_info = $DB->getOne('member_t');
    }

    $result_data = array(
        'mt_idx' => $mt_idx, // 어떤 사용자의 정보인지 포함
        'source' => 'unknown'
    );

    // 3. 로그 데이터가 있으면 로그에서 위치 가져오기
    if ($mllt_row['mlt_idx'] && !empty($mllt_row['mlt_lat']) && !empty($mllt_row['mlt_long'])) {
        $result_data['mlt_lat'] = $mllt_row['mlt_lat'];
        $result_data['mlt_long'] = $mllt_row['mlt_long'];
        $result_data['source'] = 'location_log';
        $result_data['timestamp'] = $mllt_row['mlt_gps_time'];
        
        // 로그 남기기 - 요청 및 응답 정보
        error_log("Location request for user $mt_idx: Found in location_log - Lat: {$mllt_row['mlt_lat']}, Long: {$mllt_row['mlt_long']}");
    } 
    // 4. 멤버 테이블에 위치 정보가 있으면 사용
    elseif ($member_info && !empty($member_info['mt_lat']) && !empty($member_info['mt_long'])) {
        $result_data['mlt_lat'] = $member_info['mt_lat'];
        $result_data['mlt_long'] = $member_info['mt_long'];
        $result_data['source'] = 'member_info';
        
        // 로그 남기기
        error_log("Location request for user $mt_idx: Found in member_info - Lat: {$member_info['mt_lat']}, Long: {$member_info['mt_long']}");
    } 
    // 5. 요청된 사용자가 현재 로그인한 사용자와 같으면 세션 위치 사용
    elseif ($mt_idx == $_SESSION['_mt_idx'] && !empty($_SESSION['_mt_lat']) && !empty($_SESSION['_mt_long'])) {
        $result_data['mlt_lat'] = $_SESSION['_mt_lat'];
        $result_data['mlt_long'] = $_SESSION['_mt_long'];
        $result_data['source'] = 'session';
        
        // 로그 남기기
        error_log("Location request for user $mt_idx: Using session data - Lat: {$_SESSION['_mt_lat']}, Long: {$_SESSION['_mt_long']}");
    } 
    // 6. 위치 정보가 전혀 없는 경우
    else {
        $result_data['error'] = true;
        $result_data['message'] = 'Location data not available for this user';
        
        // 로그 남기기
        error_log("Location request for user $mt_idx: No location data available");
    }

    // 결과 반환
    echo json_encode($result_data);
} elseif ($_POST['act'] == "marker_reload") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }
    $DB->where('sgdt_idx', $_POST['sgdt_idx']);
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $DB->where('sgdt_show', 'Y');
    $sgdt_row = $DB->getone('smap_group_detail_t');
    // 나의 위치 마커정보 등록
    if ($sgdt_row) {
        $DB->where('mt_idx', $sgdt_row['mt_idx']);
        $mem_row = $DB->getone('member_t');

        $DB->where('mt_idx', $sgdt_row['mt_idx']);
        $DB->orderby('mlt_gps_time', 'desc');
        $mt_location_info = $DB->getone('member_location_log_t');

        unset($result_data);
        $result_data = array(
            "mt_lat" => $mt_location_info['mlt_lat'] == "" ? $mem_row['mt_lat'] : $mt_location_info['mlt_lat'],
            "mt_long" => $mt_location_info['mlt_long'] == "" ? $mem_row['mt_long'] :  $mt_location_info['mlt_long'],
            "mt_gps_time" => $mt_location_info['mlt_gps_time'] ?: "",
            "my_profile" => $mem_row['mt_file1'] == "" ? $ct_no_img_url : get_image_url($mem_row['mt_file1']),
        );
    } else {
        $DB->where('mt_idx', $_SESSION['_mt_idx']);
        $mem_row = $DB->getone('member_t');
        
        $DB->where('mt_idx', $_SESSION['_mt_idx']);
        $DB->orderby('mlt_gps_time', 'desc');
        $location_info = $DB->getone('member_location_log_t');
        
        unset($result_data);
        $result_data = array(
            "mt_lat" => $_SESSION['_mt_lat'] == "" ? $mem_row['mt_lat'] : $_SESSION['_mt_lat'],
            "mt_long" => $_SESSION['_mt_long'] == "" ? $mem_row['mt_long'] : $_SESSION['_mt_long'],
            "mt_gps_time" => $location_info['mlt_gps_time'] ?: "",
            "my_profile" => $_SESSION['_mt_file1'] == "" ? $ct_no_img_url : $_SESSION['_mt_file1'],
        );
    }
    session_location_update($_SESSION['_mt_idx']);

    $sgt_cnt = f_get_owner_cnt($_SESSION['_mt_idx']); //오너인 그룹수
    $sgdt_leader_cnt = f_get_leader_cnt($_SESSION['_mt_idx']); //리더인 그룹수
    if ($sgt_cnt > 0 || $sgdt_leader_cnt > 0) {
        // 오너,리더일 경우 해당 그룹의 그룹원 전체 조회
        $DB->where('sgt_idx', $sgdt_row['sgt_idx']);
        $DB->where('sgdt_idx', $sgdt_row['sgdt_idx'], '!=');
        $DB->where('sgdt_discharge', 'N');
        $DB->where('sgdt_exit', 'N');
        $DB->where('sgdt_show', 'Y');
        $sgdt_list = $DB->get('smap_group_detail_t');
        if ($sgdt_list) {
            $profile_count = 1;
            foreach ($sgdt_list as $sgdtg_row) {
                $DB->where('mt_idx', $sgdtg_row['mt_idx']);
                $DB->orderby('mlt_gps_time', 'desc');
                $mt_location_info = $DB->getone('member_location_log_t');

                $DB->where('mt_idx', $sgdtg_row['mt_idx']);
                $mem_row = $DB->getone('member_t');

                $result_data['profilemarkerLat_' . $profile_count] = $mt_location_info['mlt_lat'] == "" ? 37.5665 : $mt_location_info['mlt_lat'];
                $result_data['profilemarkerLong_' . $profile_count] = $mt_location_info['mlt_long'] == "" ? 126.9780 :  $mt_location_info['mlt_long'];
                $result_data['profilemarkerGpsTime_' . $profile_count] = $mt_location_info['mlt_gps_time'] ?: "";
                $result_data['profilemarkerImg_' . $profile_count] = $mem_row['mt_file1'] == "" ? $ct_no_img_url : get_image_url($mem_row['mt_file1']);
                $profile_count++;
            }
        }
        $result_data['profile_count'] = $profile_count - 1;
    }
    $result_data['marker_reload'] = 'Y';
    echo json_encode($result_data);
    exit;
} elseif ($_POST['act'] == "map_schedule_list") {
    if ($_SESSION['_mt_idx'] == '') {
        p_alert($translations['txt_login_required'], './login', '');
    }

    $event_start_date = $_POST['event_start_date'];
    
    // 사용자의 그룹 정보 가져오기
    $DB->where('mt_idx', $_SESSION['_mt_idx']);
    $DB->where('sgdt_discharge', 'N');
    $DB->where('sgdt_exit', 'N');
    $row_sgdt = $DB->getone('smap_group_detail_t', 'GROUP_CONCAT(sgt_idx) as gc_sgt_idx, GROUP_CONCAT(sgdt_idx) as gc_sgdt_idx');

    // 지도에 표시할 일정 데이터 가져오기
    $schedules = array();
    
    if ($row_sgdt['gc_sgt_idx']) {
        $query = "SELECT sst.*, mt.mt_nickname, mt.mt_file1, 
                        sgdt.sgdt_idx, sgt.sgt_title
                 FROM smap_schedule_t sst
                 JOIN smap_group_detail_t sgdt ON sst.sgdt_idx = sgdt.sgdt_idx
                 JOIN smap_group_t sgt ON sgdt.sgt_idx = sgt.sgt_idx
                 JOIN member_t mt ON sgdt.mt_idx = mt.mt_idx
                 WHERE sgt.sgt_idx IN (" . $row_sgdt['gc_sgt_idx'] . ")
                 AND sst.sst_sdate <= '$event_start_date 23:59:59'
                 AND sst.sst_edate >= '$event_start_date 00:00:00'
                 AND sst.sst_show = 'Y'
                 ORDER BY sst.sst_sdate ASC";
        
        $schedules = $DB->rawQuery($query);
    }
    
    // 결과 출력
    if ($schedules) {
        foreach ($schedules as $schedule) {
            ?>
            <div class="schedule-item">
                <div class="schedule-info">
                    <div class="group-name"><?= $schedule['sgt_title'] ?></div>
                    <div class="member-name"><?= $schedule['mt_nickname'] ?></div>
                    <div class="schedule-title"><?= $schedule['sst_title'] ?></div>
                    <div class="schedule-time">
                        <?= date('H:i', strtotime($schedule['sst_sdate'])) ?> - 
                        <?= date('H:i', strtotime($schedule['sst_edate'])) ?>
                    </div>
                </div>
            </div>
            <?php
        }
    } else {
        echo '<div class="no-schedule">' . $translations['txt_no_schedule'] . '</div>';
    }
}


include $_SERVER['DOCUMENT_ROOT'] . "/tail.inc.php";
