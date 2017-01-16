/* global chrome */

var currentLoads = []

chrome.downloads.onChanged.addListener(function (delta) {
  if (delta.endTime) {
    var ended = currentLoads.indexOf(delta.id)
    currentLoads.splice(ended, 1)
  }
})

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'download') {
    console.log(message.fileName)

    chrome.downloads.download({
      conflictAction: 'uniquify',
      saveAs: false,
      url: message.url,
      filename: 'vkmdp/' + message.fileName + '.mp3'},
      downloadId => {
        if (downloadId === undefined) {
          console.log(chrome.runtime.lastError)
        } else {
          currentLoads.push(downloadId)
        }
      })
  }
})

chrome.webRequest.onHeadersReceived.addListener(
  (info) => {
    var headers = info.responseHeaders
    var index = headers.findIndex(h => h.name.toLowerCase() === 'x-frame-options')

    if (index !== -1) headers.splice(index, 1)
    return {responseHeaders: headers}
  },
  {urls: ['*://vk.com/*'], types: ['sub_frame']},
  ['blocking', 'responseHeaders']
)
