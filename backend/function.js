var type_sub_id = getCookie('type_sub_name');
$(document).ready(function () {
    const is_capcha = false;
    callBackAjaxForm(".ajax-login", is_capcha, { is_close_poup: true });
    var lang_id = getCookie('lang_name');
    loadTitleLang(lang_id);
    $('.user .avatar').click(function (e) {
        e.preventDefault();
        elm = $('.user.dropdown');
        if ($(elm).hasClass("show")) {
            $(elm).removeClass('show');
            $(this).next().hide();
        } else {
            $(elm).addClass('show');
            $(this).next().show();
        }
    });
    $('#search-toggler').click(function (e) {
        e.preventDefault();
        $("#search").toggle();
    });

    $('#nav-menu-btn').click(function (e) {
        e.preventDefault();
        $('#search').removeClass('active');
        if ($(this).hasClass("active")) {
            $(this).removeClass('active')
            //$(".nav-menu ul").hide();
        } else {
            $(this).addClass('active');
            //$(".nav-menu ul").show();
        }
        $('.nav-menu ul').not('li ul').slideToggle("fast");
    });

    $('#search-btn').click(function (e) {
        e.preventDefault();
        $('#nav-menu-btn').removeClass('active');
        $('.nav-menu ul').not('li ul').hide();
        if ($('#search').hasClass("active")) {
            $('#search').removeClass('active')
        } else {
            $('#search').addClass('active');
        }
    });

    $('.nav-menu ul li a').click(function (e) {
        if ($(this).parent().find('ul').length > 0) {
            e.preventDefault();
            if ($(this).hasClass("active")) {
                $(this).removeClass('active')
            } else {
                $('.nav-menu ul li a').removeClass('active');
                $('.nav-menu ul li ul').hide();
                $(this).addClass('active');
            }
            $(this).parent().find('ul').slideToggle("fast");
        }
    });
    $('.btn-more-filter').click(function (e) {
        $('.more-filters').slideToggle("fast");
    });
    $('#trending-label').click(function (e) {
        e.preventDefault();
        if ($(this).hasClass("show")) {
            $(this).removeClass('show')
            $(this).parent().find('.dropdown-menu').removeClass('show');
        } else {
            $(this).addClass('show');
            $(this).parent().find('.dropdown-menu').addClass('show');
        }
    });
    $('#menu ul li a.submenu').click(function (e) {
        e.preventDefault();
        if ($(this).parent().hasClass("active")) {
            $(this).parent().removeClass('active');
            $(this).parent().find("ul.c4").hide();
        } else {
            $("ul.c4").hide();
            $('#menu li').removeClass('active');
            $(this).parent().addClass('active');
            $(this).parent().find("ul.c4").show();
        }
    });
    $('.lang-sw span').click(function (e) {
        var id = $(this).attr('data-value');
        //alert(id);
        setCookie('lang_name', id, 30);
        loadTitleLang(id, 1);
        //var lang = getCookie('lang_name');
        //alert(lang);
    });
    $('#player-server .server-type .tab').click(function (e) {
        e.preventDefault();
        const data_id = $(this).attr('data-id');
        $(this).parent().find('.tab').removeClass('active');
        $(this).addClass('active');
        $(this).parent().parent().find('.server-items').removeClass('active');
        $(this).parent().parent().find('.server-items[data-id=' + data_id + ']').addClass('active');
        setCookie('type_sub_name', data_id, 30);
    });
    $('.form-check-input').on('change', function () {
        if ($(this).is(':checked')) {
            $('.entity-section .main-entity.collapse').addClass('active');
        } else {
            $('.entity-section .main-entity.collapse').removeClass('active');
        }
    });
    $('#player-server .server-items .server').click(function (e) {
        const play_streaming = $(this).attr('data-video');
        $('.server-video').removeClass('active');
        $(this).addClass('active');
        loadIframePlayer2(play_streaming);
        const data_id = $(this).parent().attr('data-id');
        //setCookie('type_sub_name', data_id, 30);
    });
    $('.modal-trigger').click(function (e) {
        e.preventDefault();
        const data_id = $(this).attr('data-id');
        modalPopupOpen(this, data_id)
    });
    $('.modal-poup').on('click', function (e) {
        if (e.target === this) {
            modalPopupClose(this);
        }
    });
    $('.dropdown button').click(function (e) {
        e.preventDefault();
        dropdownToggle(this);
    });
    $(document).on('click', function (e) {
        if (!$(e.target).closest('.dropdown').length) {
            $(".dropdown-menu").removeClass('show');
        }
    });
    $('.loadCommentDis span').click(function (e) {
        e.preventDefault();
        const elm = $(this).attr('data-id');
        $('.loadCommentDis span').removeClass('active');
        $(this).addClass('active');
        //reloadShareThis(elm);
    });
    // search quick
    var id = -1;
    var timer, value;
    var elm_form_search = '.ajax-search-quick';
    var elm_show_data = '.show-data';
    $(elm_form_search + " input[name='keyword']").on('keyup keydown paste focus blur', function (e) {
        var keyword = $(this).val();
        keyword = formatKeywords(keyword);
        if (e.type == 'keyup') {
            clearTimeout(timer);
            if (keyword.trim().length >= 2 && value != keyword) {
                timer = setTimeout(function () {
                    value = keyword;
                    doSearchQuick(e, this);
                }, 1000);
            }
            if (keyword.trim().length == 0) {
                $(elm_show_data).hide().html('');
            }
        }
        if (e.type == 'paste') {
            var element = $(e.target);
            setTimeout(function () {
                var keyword = $(element).val();
                keyword = formatKeywords(keyword);
                doSearchQuick(e, this);
            }, 1000);
        }
        if (e.type == 'focus') {
            if (keyword.trim().length == 0) {
                //$(elm_show_data).hide().html('');
            } else {
                if ($(elm_show_data).html() !== "") {
                    $(elm_show_data).show();
                }
            }
        }
        if (e.type == 'blur') {
            if ($(elm_form_search).is(":hover") === !0) {
            } else {
                var keyword = "";
                //
                if ($(elm_show_data).is(":hover") === !0) {

                } else {
                    $(elm_show_data).hide();
                }
            }
        }
    });
});
function formatKeywords(keyword) {
    var key = keyword.replace(/\s+/g, "+");
    key = key.replace("&", "%");
    return key;
}
function doSearchQuick(e, obj) {
    e.preventDefault();
    $("input[name='keyword']").focus();
    var elm_form_search = '.ajax-search-quick';
    var elm_show_data = '.show-data';
    var keyword = $(elm_form_search + " input[name='keyword']").val(); search = formatKeywords(keyword);
    var action_form = $(elm_form_search).attr('action');
    if (keyword.length > 2) {
        $('.loadings').show();
        callBackAjaxData(action_form + '?keyword=' + keyword, function (response) {
            $('.loadings').hide();
            $(elm_show_data).show().html(response);
        });
    }
}
function modalPopupOpen(obj, elm = 'login', capcha = true) {
    $('.modal-poup').addClass('show');
    $('#load-fade-poup').html('<div class="modal-backdrop fade show"></div>');
    $('.modal-content').hide();
    $('.modal-content.' + elm).show();
    if (is_capcha === true && elm != 'signin') {
        $('.modal-content .captcha').html('');
        $('.modal-content.' + elm + ' .captcha').load(base_url + 'load-capcha');
    }
}
function modalPopupClose(obj, elm = 'login', capcha = true) {
    $('.modal-poup').removeClass('show');
    $('#load-fade-poup').html('');
    if (capcha === true) {
        //grecaptcha.reset();   
        $('.modal-content .captcha').html('');
    }
}
function checkForm(elm_form, capcha, elm_success) {
    if (capcha === true) {
        var recaptcha = $(elm_form + " .captcha #g-recaptcha-response").val();
        if (recaptcha === "") {
            event.preventDefault();
            $(elm_success).show().html("Please check the recaptcha");
            return false;
        }
    }
    return true;
}
function ajaxTimeOut(elm) {
    $(elm).css({ 'opacity': '0.5' });
    setTimeout(function () {
        $(elm).css({ 'opacity': '1' });
    }, 500);
}
function ajaxLoadShow(elm) {
    $(elm).css({ 'opacity': '0.5' });
}
function ajaxLoadHide(elm) {
    $(elm).css({ 'opacity': '1' });
}
function loadHomeWidget(obj, alias) {
    var elm = '.load-widget';
    if (alias == 'random') {
        $(obj).parent().find('span').removeClass('active');
        $(obj).addClass('active');
        ajaxLoadShow(elm);
        setTimeout(function () {
            callBackAjaxData(base_url + 'ajax/widget/' + alias + '?page=1', function (response) {
                ajaxLoadHide(elm);
                $(elm).html(response);
            });
        }, 300);
    } else {
        if (!$(obj).hasClass('active')) {
            $(obj).parent().find('span').removeClass('active');
            $(obj).addClass('active');
            ajaxLoadShow(elm);
            callBackAjaxData(base_url + 'ajax/widget/' + alias + '?page=1', function (response) {
                ajaxLoadHide(elm);
                $(elm).html(response);
                if (alias == 'updated-dub') {
                    $('.ep-status.sub').hide();
                }
                if (alias == 'updated-sub') {
                    $('.ep-status.dub').hide();
                }
            });
        }
    }
}
function loadHomeWidgetPage(obj, status = '') {
    if ($('#alias_home').length > 0 && $('#alias_home').val() != '') {
        var alias = $('#alias_home').val();
    } else {
        var alias = 'updated-all';
    }
    if ($('#page_home').length > 0 && $('#page_home').val() != '') {
        var page = $('#page_home').val();
    } else {
        var page = 1;
    }
    if (status == 'prev') {
        page = parseInt(page) - 1;
    } else {
        page = parseInt(page) + 1;
    }
    if (page == 0) page = 1;

    var elm = '.load-widget';
    ajaxLoadShow(elm);
    callBackAjaxData(base_url + 'ajax/widget/' + alias + '?page=' + page, function (response) {
        ajaxLoadHide(elm);
        $(elm).html(response);
        if (alias == 'updated-dub') {
            $('.ep-status.sub').hide();
        }
        if (alias == 'updated-sub') {
            $('.ep-status.dub').hide();
        }
    });
}
function loadTopViews(obj, id) {
    const text = $(obj).text();
    $("#trending-label").addClass('show').text(text);
    $(obj).parent().removeClass('show');
    if (id > 0) {
        var elm = '.load-top-view';
        ajaxLoadShow(elm);
        if (!$(obj).hasClass('active')) {
            callBackAjaxData(base_url + 'ajax/top-view?id=' + id, function (response) {
                ajaxLoadHide(elm);
                $(obj).parent().find('a').removeClass('active');
                $(obj).addClass('active');
                $(elm).html(response);
            });
        }
    }
}
function callBackAjaxData(url, callback, data = {}, type = 'GET', dataType = 'html') {
    $.ajax({
        type: type,
        dataType: dataType,
        url: url,
        data: data,
        success: function (response) {
            callback(response)
        },
        error: function (response) {
            callback(response)
        }
    });
}
function loadCapCha(elm_form) {
    $(elm_form + ' .captcha').load(base_url + 'load-capcha');
}
function callBackAjaxForm(elm_form, capcha = true, params = { is_close_poup: false }, type = 'POST', dataType = 'json') {
    $(document).off('submit.ajaxForm', elm_form).on('submit.ajaxForm', elm_form, function (e) {
        e.preventDefault();
        var form = $(this);
        if (form.data('is-submitting')) {
            return false;
        }
        var elm_load = '.loading';
        var elm_danger = elm_form + ' .alert-danger';
        var elm_success = elm_form + ' .alert-success';
        var url = form.attr('action');
        $(elm_danger).hide();
        var chk = checkForm(elm_form, capcha, elm_danger);
        if (chk) {
            form.data('is-submitting', true);
            $(elm_load).show();
            $(elm_form + ' [type="submit"]').addClass('disabled').prop('disabled', true);
            $.ajax({
                type: type,
                dataType: dataType,
                url: url,
                data: form.serialize() + "&capcha=" + capcha,
                success: function (data) {
                    var message = '';
                    $.each(data.messages, function () {
                        message += this + '<br>';
                    });
                    if (capcha === true) {
                        var count = 0;
                        $(".g-recaptcha").each(function () {
                            grecaptcha.reset(count);
                            count++;
                        });
                    }
                    $(elm_load).hide();
                    form.data('is-submitting', false);
                    $(elm_form + ' [type="submit"]').removeClass('disabled').prop('disabled', false);
                    if (data.status == 200) {
                        $(elm_danger).hide();
                        $(elm_success).show().html(message);
                        $(elm_form).trigger("reset");
                        setTimeout(function () {
                            $(elm_success).hide();
                            if (typeof params.is_close_poup !== "undefined" && params.is_close_poup && params.is_close_poup === true) {
                                modalPopupClose(this);
                            }
                            if (typeof params.is_reload !== "undefined" && params.is_reload && params.is_reload === true) {

                            } else {
                                if (data.url_redirect != '') {
                                    window.location = data.url_redirect;
                                } else {
                                    if (params.url_redirect != undefined && params.url_redirect != null) {
                                        window.location = params.url_redirect;
                                    } else {
                                        location.reload();
                                    }
                                }
                            }
                        }, 2000);
                        if (typeof params.is_send !== "undefined" && params.is_send && params.is_send === true) {
                            if (document.getElementById('report-episode-is_send')) {
                                $('#report-episode-is_send').val('true');
                            }
                        }
                    } else {
                        $(elm_success).hide();
                        $(elm_danger).show().html(message);
                    }
                },
                error: function (data) {
                    $(elm_load).hide();
                    form.data('is-submitting', false);
                    $(elm_form + ' [type="submit"]').removeClass('disabled').prop('disabled', false);
                }
            });
        }
    });
}
function getLinkIframeDefault() {
    let link_iframe = '';
    const elm_link = '.server-video';
    const elm_tab = '.server-tab';
    if (type_sub_id) {
        $(elm_tab+' .tab').each(function (index, element) {
            const data_tab_id = $(element).attr('data-id');
            if(data_tab_id == type_sub_id){
                $(elm_link).removeClass('default');
                $('.server-items[data-id="' + data_tab_id + '"]').first().find('.server-video').addClass('default');
            }
        });
    } 
    $(elm_link).each(function (index, element) {
        const link_tmp = $(element).attr('data-video');
        const data_tab = $(element).attr('data-tab');
        if ($(element).hasClass("default")) {
            if (link_tmp != '') {
                link_iframe = link_tmp;
                $(element).addClass('active');
                $(element).parent().addClass('active');
                $(elm_tab + ' .' + data_tab).addClass('active');
                return false;
            }
        }
    });
    if (link_iframe == '') {
        $(elm_link).each(function (index, element) {
            const link_tmp = $(element).attr('data-video');
            const data_tab = $(element).attr('data-tab');
            if (link_tmp != '') {
                link_iframe = link_tmp;
                $(element).addClass('active');
                $(element).parent().addClass('active');
                $(elm_tab + ' .' + data_tab).addClass('active');
                return false;
            }
        });
    }
    loadIframePlayer2(link_iframe);
}
function loadIframePlayer2(link_iframe = '') {
    if (link_iframe != '') {
        $('html,body').animate({
            scrollTop: $(".play-video").offset().top
        }, 1000);
        $(".play-video iframe").attr('src', link_iframe);
        $('.loading.watchs').show();
        setTimeout(function () {
            $('.loading.watchs').hide();
        }, 1000);
    }
}
function setCookie(c_name, value, expiredays) {
    var exdate = new Date();
    exdate.setDate(exdate.getDate() + expiredays);
    var cookieValue = encodeURIComponent(value);
    var expires = (expiredays == null) ? "" : ";expires=" + exdate.toUTCString();
    document.cookie = c_name + "=" + cookieValue + expires + ";path=/";
}
function getCookie(key) {
    var keyValue = document.cookie.match('(^|;) ?' + key + '=([^;]*)(;|$)');
    return keyValue ? decodeURIComponent(keyValue[2]) : null;
}
function loadEP(value) {
    var elm_dropdown = '.range .dropdown-item';
    $(elm_dropdown).removeClass('active');
    $(elm_dropdown + '[data-value="' + value + '"]').addClass('active');
    $('.dropdown-menu').hide();
    $('.dropdown.filter').removeClass('show');
    $(".range .dropdown-item").parent().parent().find('.dropdown-toggle').html(value);
    $(".ep-range").removeClass('active');
    $(".ep-range[data-range='" + value + "']").addClass('active');
}
function loadComment(id) {
    var link = $('#comments .tab[data-type="' + id + '"]').attr('data-link');
}
function dropdownToggle(obj) {
    if ($(obj).parent().find('.dropdown-menu').hasClass("show")) {
    } else {
        $('.dropdown-menu').removeClass('show');
    }
    $(obj).parent().find('.dropdown-menu').toggleClass("show");
}
function addBookmarkContent(elm, data = {}, load = 'loading') {
    $(elm).addClass('disabled');
    dropdownToggle(elm);
    callBackAjaxData(base_url + 'user/bookmark-content?load=' + load, function (response) {
        if (response.status == 401) {
            $(elm).removeClass('disabled');
            if ($('.modal-trigger[data-id="signin"]').length > 0) {
                $('.modal-trigger[data-id="signin"]').first().trigger('click');
            } else if (response.url_redirect) {
                window.location = response.url_redirect;
            }
            return;
        }
        $(elm).parent().find('.dropdown-item').removeClass('active');
        $(elm).removeClass('disabled');
        if (response.idfolder_response > 0) {
            $(elm).parent().find('.dropdown-item' + '[data-id=' + response.idfolder_response + ']').addClass('active');
            if (response.namefolder_response != '') {
                $(elm).parent().parent().find('button').text(response.namefolder_response);
            }
            $(elm).parent().find('.dropdown-item' + '[data-id=0]').show();
        } else {
            $(elm).parent().find('.dropdown-item' + '[data-id=0]').hide();
        }
    }, data, 'GET', 'json');
}
function bindWatchlistButtons() {
    $(document).off('click.nvWatchlistDropdown', '.user-bookmark[data-content-id] .add-lists-bookmark a');
    $(document).on('click.nvWatchlistDropdown', '.user-bookmark[data-content-id] .add-lists-bookmark a', function (e) {
        e.preventDefault();
        var wrapper = $(this).closest('.user-bookmark[data-content-id]');
        var idcontent = parseInt(wrapper.attr('data-content-id'), 10);
        var ep = parseInt(wrapper.attr('data-episode'), 10) || 1;
        var idfolder = parseInt($(this).attr('data-id'), 10);

        if (!idcontent || isNaN(idfolder)) {
            return;
        }

        addBookmarkContent(this, {
            idcontent: idcontent,
            ep: ep,
            idfolder: idfolder
        }, 'loading');
    });

    $(document).off('click.nvWatchlist', '.user-bookmark[data-content-id]');
    $(document).on('click.nvWatchlist', '.user-bookmark[data-content-id]', function (e) {
        if ($(e.target).closest('.add-lists-bookmark, .dropdown-menu').length > 0) {
            return;
        }
        e.preventDefault();
        var button = $(this);
        if (button.find('.add-lists-bookmark').length > 0) {
            return;
        }
        if (button.hasClass('disabled')) {
            return;
        }

        var idcontent = parseInt(button.attr('data-content-id'), 10);
        var ep = parseInt(button.attr('data-episode'), 10);
        var idfolder = parseInt(button.attr('data-folder'), 10);

        if (!idcontent) {
            return;
        }
        if (!ep) {
            ep = 1;
        }
        if (!idfolder) {
            idfolder = 1;
        }

        button.addClass('disabled is-loading');
        callBackAjaxData(base_url + 'user/bookmark-content?load=loading', function (response) {
            button.removeClass('disabled is-loading');

            if (response.status == 401) {
                if ($('.modal-trigger[data-id="signin"]').length > 0) {
                    $('.modal-trigger[data-id="signin"]').first().trigger('click');
                } else if (response.url_redirect) {
                    window.location = response.url_redirect;
                }
                return;
            }

            if (response.idfolder_response > 0) {
                button.addClass('active is-saved').attr('data-folder', response.idfolder_response);
                button.contents().filter(function () {
                    return this.nodeType === 3;
                }).first().replaceWith('In Watchlist ');
            } else {
                button.removeClass('active is-saved').attr('data-folder', 1);
                button.contents().filter(function () {
                    return this.nodeType === 3;
                }).first().replaceWith('Add Watchlist ');
            }
        }, {
            idcontent: idcontent,
            ep: ep,
            idfolder: idfolder
        }, 'GET', 'json');
    });
}
$(function () {
    bindWatchlistButtons();
});
function findArrayUrl(obj, val) {
    return $.grep(obj, function (item) {
        return item.id == val;
    });
};
function loadTitleLang(id, count = 0) {
    //alert(id);
    if (id == null) {
        id = 'en';
    }
    //alert(id);
    $('.lang-sw span').removeClass('active');
    $('.lang-sw span[data-value="' + id + '"]').addClass('active');

    if (count == 0) {
        if (id == 'jp') {
            $('.d-title').each(function () {
                var title = $(this).attr('data-jp');
                console.log(title);
                if (title != '') {
                    $(this).text(title);
                }
            });
        }
    } else {
        $('.d-title').each(function () {
            if (id == 'en') {
                var title = $(this).attr('data-en');
            } else {
                var title = $(this).attr('data-jp');
            }
            if (title != '') {
                $(this).text(title);
            }
        });
    }
}
setInterval(showTime, 1000);
function loadTabHome(elm) {
    $('.body .top-table').hide();
    $('.body .top-table[data-name="' + elm + '"]').show();
}
function showTime() {
    var time = new Date();
    var hour = time.getHours();
    var min = time.getMinutes();
    var sec = time.getSeconds();
    var am_pm = "AM";

    if (hour > 12) {
        hour -= 12;
        am_pm = "PM";
    }
    if (hour == 0) {
        hour = 12;
        am_pm = "AM";
    }

    hour = hour < 10 ? "0" + hour : hour;
    min = min < 10 ? "0" + min : min;
    sec = sec < 10 ? "0" + sec : sec;

    var currentTime = hour + ":" + min + ":" + sec + " " + am_pm;
    $('#clock').html(currentTime);
}
var date = new Date();
$('#current-date').text(date.toLocaleDateString());
showTime();
function expandPlayer(e, obj) {

}
function focusPlayer(e, obj) {
    $('.player-main').addClass('focus-layer');
    $('.player-section').css({ 'z-index': 'unset' });
    $('.mask-player').show();
}
function closePlayer(e, obj) {
    $('.player-main').removeClass('focus-layer');
    $('.player-section').css({ 'z-index': '3' });
    $('.mask-player').hide();
}
function nextPrevPlayer(e, obj, url) {
    window.location.href = url;
}
function onOffComment(obj) {
    $('.load-comment').slideToggle("fast");
}
function reloadShareThis(elm) {
    const url = $('.loadCommentDis span[data-id="' + elm + '"]').attr('data-url');
    var disqus_config = function () {
        this.page.url = 'https://gogoanimez.cc/anime/fategrand-order-youve-lost-ritsuka-fujimaru-season-3';
    };
    (function () {  // DON'T EDIT BELOW THIS LINE
        var d = document, s = d.createElement('script');

        s.src = 'https://anitakuto.disqus.com/embed.js';

        s.setAttribute('data-timestamp', +new Date());
        (d.head || d.body).appendChild(s);
    })();
}
(function () {
    const currentUserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const savedTz = getCookie("user_timezone");
    if (!savedTz || savedTz !== currentUserTz) {
        document.cookie = "user_timezone=" + currentUserTz + ";path=/;max-age=604800;SameSite=Lax;Secure";
    }
})();
function getCookie(name) {
    let value = "; " + document.cookie;
    let parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
}
