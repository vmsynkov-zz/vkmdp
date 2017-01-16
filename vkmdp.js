/* global chrome */

var badFileReg = /[\\~#%&*{}/:<>?|"]/gi
var albumIdReg = /(-?\d+)_(-?\d+)/
var trackUrlReg = /https.*?"/
var vkApiVer = '5.62'
var extOrigin = 'chrome-extension://' + chrome.i18n.getMessage('@@extension_id')

/**
 * Inserts all load btns and registers observer for body
 */
;(function init () {
  var audioRows = document.querySelectorAll('.audio_row')
  audioRows.forEach(row => {
    addRowBtn(row)
  })

  addPlayerBtn(document)
  addAlbumBtn(document)
  addObserver()

  window.top.postMessage('loaded', extOrigin)
})()

/**
 * Marks HTMLElement to not be processed multiple times
 *
 * @param {HTMLElement} element
 * @returns {number} 0 if element was previously marked and 1 otherwise
 */
function mark (element) {
  // eslint-disable-next-line
  return element.dataset.vkmdp ? 0 : element.dataset.vkmdp = 1
}

/**
 * Adds download button after play button in .audio_row
 *
 * @param {HTMLElement} audioRow
 */
function addRowBtn (audioRow) {
  if (!mark(audioRow)) return
  var btn = createLoadBtn(null, ['vkmpd_loadBtn'], singleDownload)
  audioRow.insertBefore(btn, audioRow.children[1])
  audioRow.addEventListener('click', () => {
    var data = JSON.parse(audioRow.dataset.audio)
    updatePlayerBtn(data)
  })
}

/**
 * Performs song download on load btn click
 *
 * @param {Event} event
 */
function singleDownload (event) {
  event.stopPropagation()
  event.preventDefault()
  var data = event.target.dataset
  var uid = data.userId
  var tid = data.trackId
  var fileName = data.artist + ' – ' + data.song
  getUrl(uid, tid, (err, url) => {
    if (err) console.log(err)
    chrome.runtime.sendMessage({type: 'download', url, fileName})
  })
}

function addObserver () {
  var target = document.body
  var observer = new window.MutationObserver(function handleObserve (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return
          var isAudio = node.className.includes('audio_row')
          var hasAudios = node.innerHTML.includes('audio_row')
          var hasAlbums = node.innerHTML.includes('ui_rmenu_audio_album')
          var hasPagePlayer = node.innerHTML.includes('audio_page_player')
          if (isAudio) {
            addRowBtn(node)
          }
          if (hasAudios) {
            node.querySelectorAll('.audio_row').forEach(row => {
              addRowBtn(row)
            })
          }
          if (hasAlbums) {
            addAlbumBtn(node)
          }
          if (hasPagePlayer) {
            addPlayerBtn(node)
          }
        })
      }

      if (mutation.type === 'attributes' && mutation.target.className.includes('audio_page_player')) {
        addPlayerBtn(document)
      }
    })
  })
  var config = {subtree: true, childList: true, attributes: true}
  observer.observe(target, config)
}

/**
 * Handler that changes players load btn dataset when .audio_row play btn was clicked
 *
 * @param {trackData} data
 */
function updatePlayerBtn (data) {
  var players = document.querySelectorAll('.audio_page_player')
  players.forEach(player => {
    player.dataset.audio = JSON.stringify(data)
  })
}

/**
 *  Adds load btn to .audio_page_player
 *
 * @param {Node} root Root node to search for .audio_page_player
 */
function addPlayerBtn (root) {
  var players = root.querySelectorAll('.audio_page_player')
  players.forEach(player => {
    if (!player.dataset.audio) return
    if (!mark(player)) return
    var btn = createLoadBtn(null, ['vkmpd_loadBtn', 'vkmpd_loadBtn__player'], singleDownload)
    player.insertBefore(btn, player.children[1])
  })
}

/**
 * Creates load btn element
 *
 * @param {trackData} data Song info to attack to dataset
 * @param {string[]} cssClasses Array of css classes to attach
 * @param {Function} clickHandler Function to call when btn is clicked
 * @returns {HTMLElement}
 */
function createLoadBtn (data, cssClasses, clickHandler) {
  var btn = document.createElement('div')
  for (var prop in data) {
    btn.dataset[prop] = data[prop]
  }

  btn.className = cssClasses.join(' ')

  btn.addEventListener('click', clickHandler)

  return btn
}

function getUrl (userId, trackId, cb) {
  var url = '/al_audio.php'
  var data = {
    act: 'reload_audio',
    al: 1,
    ids: `${userId}_${trackId}`
  }
  xhr('post', url, data, (err, res) => {
    if (err) {
      cb(err)
    } else {
      try {
        var url = res.match(trackUrlReg)[0].slice(0, -1).replace(/\\/g, '')
        cb(null, url)
      } catch (e) {
        cb(e)
      }
    }
  })
}

function getPlaylist (userId, albumId, cb) {
  var data = {
    act: 'load_silent',
    al: 1,
    album_id: albumId,
    band: false,
    owner_id: userId
  }
  var url = '/al_audio.php'
  xhr('post', url, data, (err, res) => {
    if (err) cb(err)
    else {
      try {
        var playlist = JSON.parse(/<!json>(.+)<!>/.exec(res)[1]).list
        cb(null, playlist)
      } catch (e) {
        cb(e)
      }
    }
  })
}

function downloadAlbum (event) {
  var data = event.target.dataset
  event.stopPropagation()
  event.preventDefault()
  var uid = data.userId
  var aid = data.albumId
  getNameById(uid, (err, res) => {
    if (err) console.log(err)
    console.log(res)
    getPlaylist(uid, aid, (err, res) => {
      if (err) console.log(err)
      console.log(res)
    })
  })
}

function addAlbumBtn (root) {
  var albums = root.querySelectorAll(`a[id^=ui_rmenu_audio_album]`)
  if (!albums) return
  var ids
  var albumId
  var albumName
  var span
  var btn
  albums.forEach((album) => {
    if (!mark(album)) return

    ids = album.id.match(albumIdReg)
    albumId = ids[2]

    if (albumId === '-2') albumName = 'All'
    else albumName = fixFileString(album.querySelector('.audio_album_title').innerText)

    span = album.firstElementChild
    btn = createLoadBtn({userId: ids[1], albumId, albumName}, ['vkmpd_loadBtn', 'vkmpd_loadBtn__album'], downloadAlbum)
    span.insertBefore(btn, span.firstElementChild)
  })
}

function fixFileString (string) {
  var fixedString = string.replace(badFileReg, '')
  return fixedString.trim()
}

function getNameById (id, cb) {
  var url = `https://api.vk.com/method/`
  var data = {
    v: vkApiVer
  }
  if (id < 0) {
    data.group_id = -id
    url += 'groups.getById'
  } else {
    data.user_id = id
    url += 'users.get'
  }
  xhr('post', url, data, (err, res) => {
    if (err) cb(err)
    res = JSON.parse(res).response[0]
    if (res.name) cb(null, res.name)
    else cb(null, res.first_name + ' ' + res.last_name)
  })
}

function xhr (method, url, data, cb) {
  var DONE = 4
  var OK = 200
  var xhr = new window.XMLHttpRequest()
  xhr.onerror = function () {
    console.log('An error occurred during the transaction')
  }
  xhr.open(method.toUpperCase(), url)
  if (method === 'post') {
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
  }
  xhr.onreadystatechange = function () {
    if (xhr.readyState === DONE) {
      if (xhr.status === OK) {
        cb(null, xhr.responseText)
      } else {
        cb(xhr.status)
      }
    }
  }
  xhr.send(encodeParams(data))
}

function encodeParams (object) {
  var encoded = ''
  for (var prop in object) {
    if (object.hasOwnProperty(prop)) {
      if (encoded.length > 0) encoded += '&'
      encoded += encodeURI(prop + '=' + object[prop])
    }
  }
  return encoded
}
