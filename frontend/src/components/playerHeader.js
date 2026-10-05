/**
 * Компонент шапки профілю гравця
 */

import { $, show, hide, escapeHtml } from '../utils/dom.js';

const FACEIT_LVL11_ELO_THRESHOLD = 3806;

export function renderPlayerHeader(data) {
    $('playerName').textContent = data.nickname;

    if (data.avatar) {
        const img = $('playerAvatar');
        img.onerror = () => {
            hide(img);
            show('playerAvatarFallback');
        };
        img.src = data.avatar;
        show(img);
        hide('playerAvatarFallback');
    } else {
        hide('playerAvatar');
        show('playerAvatarFallback');
    }

    if (data.country) {
        const flag = $('playerFlag');
        flag.src = `https://flagcdn.com/w40/${data.country.toLowerCase()}.png`;
        show(flag);
        try {
            flag.title = new Intl.DisplayNames(['uk'], { type: 'region' }).of(data.country.toUpperCase());
        } catch {
            flag.title = data.country.toUpperCase();
        }
    } else {
        hide('playerFlag');
    }

    const cs2Info = data.games?.cs2 || {};
    const elo = cs2Info.faceit_elo || 0;
    let lvl = cs2Info.skill_level || 1;
    if (lvl === 10 && elo >= FACEIT_LVL11_ELO_THRESHOLD) {
        lvl = 11;
    }

    const lvlIcon = $('playerLevelIcon');
    lvlIcon.onerror = () => {
        lvlIcon.onerror = null;
        lvlIcon.src = `https://cdn-frontend.faceit.com/m/master/app/assets/images/badges/skill_level_${lvl}_svg.svg`;
    };
    lvlIcon.src = `assets/level${lvl}.svg`;
    show(lvlIcon);
    hide('playerLevelFallback');

    $('playerElo').textContent = elo;

    $('linkFaceit').href = `https://www.faceit.com/en/players/${encodeURIComponent(data.nickname)}`;
    const steamLink = $('linkSteam');
    if (data.steam_id_64) {
        steamLink.href = `https://steamcommunity.com/profiles/${encodeURIComponent(data.steam_id_64)}`;
        show(steamLink);
    } else {
        hide(steamLink);
    }

    show('playerCard');
    const footer = $('appFooter');
    if (footer) show(footer);
}
