//Addon essential requires
var pageMod = require("sdk/page-mod");
var self = require("sdk/self");
//var { MatchPattern } = require("sdk/util/match-pattern");
var simpleStorage = require("sdk/simple-storage");
var { indexedDB } = require('sdk/indexed-db');

//UI related requires
var { ToggleButton } = require('sdk/ui/button/toggle');
var panels = require("sdk/panel");
var tabs = require("sdk/tabs");

//Update related requires
var timers = require("sdk/timers");
var notifications = false;
var batoto = false;
var mangafox = false;
var mangastream = false;

//http://bato.to/read/_/322387/he-is-a-high-school-girl_ch13_by_easy-going-scans?supress_webtoon=t
//This chapter and the next is having problems loading the first page

//Support mangacow?!

// Mandar o shimizu tomar no cu

// Bug
// Mudar o layout para página dupla, redimensionar a janela para não caber as duas páginas e mudar para página simples, faz as páginas inverterem a ordem

if (typeof CERTAINMANGA == 'undefined' || CERTAINMANGA == null) {
	CERTAINMANGA = {};

	CERTAINMANGA.pageModOptions = {
		"addStar": self.data.url("img/add-star-24.png"),
		"removeStar": self.data.url("img/remove-star-24.png"),
		"home": self.data.url("img/home-24.png"),
		"back": self.data.url("img/back-24.png"),
		"next": self.data.url("img/next-24.png"),
		"flag": self.data.url("img/flag-24.png"),
		"single": self.data.url("img/single-24.png"),
		"double": self.data.url("img/double-24.png"),
		"loadingIcon": self.data.url("img/circle-loading.gif"),
		"batoto": self.data.url("img/icon-batoto.png"),
		"mangafox": self.data.url("img/icon-mangafox.png"),
		"mangastream": self.data.url("img/icon-mangastream.png"),
		"gear": self.data.url("img/gear-16.png"),
		"play": self.data.url("img/play-16.png"),
		"remove": self.data.url("img/remove-16.png"),
		"mark": self.data.url("img/mark-16.png"),
		"mangastreamCover": self.data.url("img/mangastream-cover.png"),
		"error404": self.data.url("img/error404.png")
	};

	CERTAINMANGA.data = {};
	CERTAINMANGA.data.mangaList = [];

	CERTAINMANGA.bLoading = {
		options: false,
		mangas: false,
		startAddon: function() {
			if (CERTAINMANGA.bLoading.options && CERTAINMANGA.bLoading.mangas) {
				CERTAINMANGA.StartAddon();
			}
		}
	};

	CERTAINMANGA.bIsUpdating = false;
	CERTAINMANGA.updateTimer = false;
	CERTAINMANGA.currentlyUpdating = 0;
	CERTAINMANGA.NETSAVEINCREASEBY = 43200000;

	CERTAINMANGA.workers = [];
}

CERTAINMANGA.OpenDatabase = function OpenDatabase() {
	var database = {
		onerror: function(e) {
			console.log(e);
		},
		onsuccess: function(e) {

		}
	};

	var request = indexedDB.open("ACertainMangaReaderDatabase", 1);
	request.onerror = database.onerror;
	request.onsuccess = function (e) {
		database.db = e.target.result;
		database.db.onerror = database.onerror;

		CERTAINMANGA.databaseHandler = database;

		CERTAINMANGA.InitializeOptions();
		CERTAINMANGA.InitializeMangas();
		console.log("Database opened");
	};

	request.onupgradeneeded = function(event) {
		if (event.version == 1) {
			CERTAINMANGA.bFirstTime = true;
		}

		var db = event.target.result;

		var optionStore = db.createObjectStore("options", { keyPath: "key" });

		if (simpleStorage.storage.data) {
			optionStore.add({key: "bIsOn", value: simpleStorage.storage.data.bIsOn ? true : false});
			optionStore.add({key: "bNotifications", value: simpleStorage.storage.data.bNotifications ? true : false});
			optionStore.add({key: "updateTime", value: simpleStorage.storage.data.updateTime ? simpleStorage.storage.data.updateTime : 43200000});
			optionStore.add({key: "maxUpdateTime", value: simpleStorage.storage.data.maxUpdateTime ? simpleStorage.storage.data.maxUpdateTime : 604800000});
			optionStore.add({key: "bNetworkSaving", value: simpleStorage.storage.data.bNetworkSaving ? true : false});
			optionStore.add({key: "bCompactDesign", value: simpleStorage.storage.data.bCompactDesign ? true : false});
			optionStore.add({key: "bShowPageNumbers", value: simpleStorage.storage.data.bShowPageNumbers ? true : false});
			optionStore.add({key: "bInfiniteScrolling", value: simpleStorage.storage.data.bInfiniteScrolling ? true : false});
		} else {
			optionStore.add({key: "bIsOn", value: true});
			optionStore.add({key: "bNotifications", value: true});
			optionStore.add({key: "updateTime", value: 43200000});
			optionStore.add({key: "maxUpdateTime", value: 604800000});
			optionStore.add({key: "bNetworkSaving", value: false});
			optionStore.add({key: "bCompactDesign", value: false});
			optionStore.add({key: "bShowPageNumbers", value: false});
			optionStore.add({key: "bInfiniteScrolling", value: true});
		}

		var mangaStore = db.createObjectStore("mangas", { keyPath: ["name", "site"] });

		mangaStore.createIndex("name", "name", { unique: false });

		mangaStore.createIndex("site", "site", { unique: false });

		mangaStore.createIndex("bRead", "bRead", { unique: false });

		mangaStore.createIndex("lastUpdatedAt", "lastUpdatedAt", { unique: false });

		if (simpleStorage.storage.data && simpleStorage.storage.data.mangaList) {
			var mangaList = simpleStorage.storage.data.mangaList;
			var count = mangaList.length;
			var x;

			while(count--) {
				x = mangaList[count].list.length;
				while(x--) {
					mangaStore.add(mangaList[count].list[x]);
				}
			}
		}

		if (simpleStorage.storage.data) {
			//delete simpleStorage.storage.data;
		}

		console.log("Database upgraded");
	}
};

/**
 * @param {string} storeType Either "options" or "mangas"
 * @param {boolean} mode Use false for readonly, and true for readwrite
 * @returns {IDBObjectStore}
 */
CERTAINMANGA.GetObjectStore = function GetObjectStore(storeType, mode) {
	var trans = CERTAINMANGA.databaseHandler.db.transaction(storeType, mode ? "readwrite" : "readonly");
	return trans.objectStore(storeType);
};

// OPTIONS =============================================================================================================

CERTAINMANGA.InitializeOptions = function InitializeOptions() {
	var objectStore = CERTAINMANGA.GetObjectStore("options", false);

	objectStore.openCursor().onsuccess = function(event) {
		var cursor = event.target.result;
		if (cursor) {
			CERTAINMANGA.data[cursor.value.key] = cursor.value.value;
			cursor.continue();
		} else {
			CERTAINMANGA.bLoading.options = true;
			CERTAINMANGA.bLoading.startAddon();
		}
	};
};

// MANGAS ==============================================================================================================

CERTAINMANGA.InitializeMangas = function InitializeMangas() {
	var objectStore = CERTAINMANGA.GetObjectStore("mangas", false);
	var index = objectStore.index("name");

	index.openCursor().onsuccess = function(event) {
		var cursor = event.target.result;
		if (cursor) {
			CERTAINMANGA.data.mangaList.push(cursor.value);
			cursor.continue();
		} else {
			CERTAINMANGA.bLoading.mangas = true;
			CERTAINMANGA.bLoading.startAddon();
		}
	};
};

CERTAINMANGA.AddToListGetSuccess = function AddToListGetSuccess(event) {
	var bAdded = false;

	var count = 0;
	var limit = CERTAINMANGA.data.mangaList.length;
	while(count < limit) {
		if (event.target.result.name.toLowerCase() <= CERTAINMANGA.data.mangaList[count].name.toLowerCase()) {
			CERTAINMANGA.data.mangaList.splice(count, 0, event.target.result);
			bAdded = true;
			break;
		}
		count++;
	}
	if (!bAdded) {
		CERTAINMANGA.data.mangaList.push(event.target.result);
	}

	CERTAINMANGA.mainPanel.port.emit("UdapteAddManga", event.target.result);
	CERTAINMANGA.UpdateWorkersManga(event.target.result.name, event.target.result.site, true);
};

CERTAINMANGA.AddToListPutSuccess = function AddToListPutSuccess(event) {
	var objectStore = CERTAINMANGA.GetObjectStore("mangas", false);
	var requestGet = objectStore.get(event.target.result);

	requestGet.onsuccess = CERTAINMANGA.AddToListGetSuccess;
	requestGet.onerror = CERTAINMANGA.databaseHandler.onerror;
};

CERTAINMANGA.AddToList = function AddToList(mangaData) {
	if (mangaData && mangaData.name) {
		var objectStore = CERTAINMANGA.GetObjectStore("mangas", true);
		var requestPut = objectStore.put(mangaData);

		requestPut.onsuccess = CERTAINMANGA.AddToListPutSuccess;
		requestPut.onerror = CERTAINMANGA.databaseHandler.onerror;
	}
};

CERTAINMANGA.RemoveFromListGetSuccess = function RemoveFromListGetSuccess(event) {
	var mangaData = {
		name: event.target.result.name,
		site: event.target.result.site
	};

	var objectStore = CERTAINMANGA.GetObjectStore("mangas", true);
	var requestDel = objectStore.delete([mangaData.name, mangaData.site]);

	requestDel.onsuccess = function(event) {
		var count = CERTAINMANGA.data.mangaList.length;
		while(count--) {
			if (CERTAINMANGA.data.mangaList[count].name == mangaData.name && CERTAINMANGA.data.mangaList[count.site] == mangaData.site) {
				CERTAINMANGA.data.mangaList.splice(count, 1);
				break;
			}
		}

		CERTAINMANGA.UpdateWorkersManga(mangaData.name, mangaData.site, false);
		CERTAINMANGA.mainPanel.port.emit("UdapteRemoveManga", mangaData)
	};

	requestDel.onerror = CERTAINMANGA.databaseHandler.onerror;
};

CERTAINMANGA.RemoveFromList = function RemoveFromList(mangaData) {
	var objectStore = CERTAINMANGA.GetObjectStore("mangas", false);
	var requestGet = objectStore.get([mangaData.name, mangaData.site]);

	requestGet.onsuccess = CERTAINMANGA.RemoveFromListGetSuccess;
	requestGet.onerror = CERTAINMANGA.databaseHandler.onerror;
};

CERTAINMANGA.UpdateMangaInfo = function UpdateMangaInfo(mangaData) {
	if (mangaData && mangaData.name) {
		var objectStore = CERTAINMANGA.GetObjectStore("mangas", true);
		var requestGet = objectStore.get([mangaData.name, mangaData.site]);

		requestGet.onerror = CERTAINMANGA.databaseHandler.onerror;
		requestGet.onsuccess = function(event) {
			var mangaDB = event.target.result;

			if (mangaData.sid) {
				mangaDB.sid = mangaData.sid;
			}

			if (mangaData.chapters) {
				if (!CERTAINMANGA.ChaptersEqual(mangaDB.chapters, mangaData.chapters)) {
					mangaDB.chapters = mangaData.chapters;
					if (mangaData.lastUpdatedAt) {
						mangaDB.lastUpdatedAt = mangaData.lastUpdatedAt;
					} else {
						mangaDB.lastUpdatedAt = Date.now();
					}
				}
			}
			if (mangaData.atChapter) {
				mangaDB.atChapter = mangaData.atChapter;
			}
			if (mangaData.bRead !== undefined && mangaData.bRead !== null) {
				mangaDB.bRead = mangaData.bRead;
			}

			var requestUpdate = objectStore.put(mangaDB);
			requestUpdate.onerror = CERTAINMANGA.databaseHandler.onerror;
			requestUpdate.onsuccess = function(event) {
				var count = CERTAINMANGA.data.mangaList.length;
				while(count--) {
					if (CERTAINMANGA.data.mangaList[count].name == mangaDB.name && CERTAINMANGA.data.mangaList[count.site] == mangaDB.site) {
						CERTAINMANGA.data.mangaList[count] = mangaDB;
						break;
					}
				}

				CERTAINMANGA.mainPanel.port.emit("UdapteUpdateManga", mangaDB);
			};
		};
	}
};

CERTAINMANGA.CheckSubscription = function CheckSubscription(mangaData, worker) {
	if (CERTAINMANGA.bFirstTime) {
		CERTAINMANGA.bFirstTime = false;
	}

	if (worker) {
		worker.mangaSite = mangaData.site;
		worker.mangaName = mangaData.name;
		CERTAINMANGA.workers.push(worker);
	}

	var objectStore = CERTAINMANGA.GetObjectStore("mangas", false);
	var requestGet = objectStore.get([mangaData.name, mangaData.site]);
	requestGet.onerror = CERTAINMANGA.databaseHandler.onerror;
	requestGet.onsuccess = function(event) {
		if (event.target.result != undefined) {
			//Yup, we have the manga!
			if (worker) {
				worker.port.emit("IsSubscribed", true);
			}

			var readingAt, savedAt;
			//Now we check if the chapter we opened is newer than the one we have saved
			var mangaGet = event.target.result;
			var count = mangaGet.chapters.length;
			while(count--) {
				if (mangaGet.chapters[count].name == mangaData.atChapter) {
					readingAt = count;
				}
				if (mangaGet.chapters[count].name == mangaGet.atChapter) {
					savedAt = count;
				}
			}

			if (savedAt == undefined || readingAt > savedAt) {
				mangaGet.atChapter = mangaData.atChapter;
				if (readingAt == mangaGet.chapters.length - 1) {
					mangaGet.bRead = true;
				}
				//CERTAINMANGA.mainPanel.port.emit("UdapteUpdateManga", mangaGet);
				CERTAINMANGA.UpdateMangaInfo(mangaGet);
			}

			return;
		}

		if (worker) {
			worker.port.emit("IsSubscribed", false);
		}
	}
};

// Menu and Buttons ====================================================================================================

CERTAINMANGA.HandleChange = function HandleChange(state) {
	if (state.checked) {
		CERTAINMANGA.mainPanel.show({
			position: CERTAINMANGA.button
		});
	}
};

CERTAINMANGA.HandleHide = function HandleHide() {
	CERTAINMANGA.button.state('window', {checked: false});
	CERTAINMANGA.mainPanel.port.emit("Hide");
};

CERTAINMANGA.HandleShow = function HandleShow() {
	CERTAINMANGA.button.badge = undefined;
	CERTAINMANGA.mainPanel.port.emit("Show");
};

CERTAINMANGA.button = ToggleButton({
	id: "certain-manga-reader",
	label: "A Certain Manga Reader",
	icon: {
		"16": self.data.url("img/icon-16.png"),
		"32": self.data.url("img/icon-32.png"),
		"64": self.data.url("img/icon-64.png")
	},
	onChange: CERTAINMANGA.HandleChange,
	disabled: true
});

CERTAINMANGA.OpenTab = function OpenTab(url) {
	tabs.open(url);
};

CERTAINMANGA.MarkAsRead = function MarkAsRead(mangaData) {
	CERTAINMANGA.CheckSubscription(mangaData);
};

CERTAINMANGA.Remove = function Remove(mangaData) {
	CERTAINMANGA.RemoveFromList(mangaData);
};

CERTAINMANGA.ChangeAddonStatus = function ChangeAddonStatus(status) {
	CERTAINMANGA.data.bIsOn = status;
	if (CERTAINMANGA.data.bIsOn) {
		CERTAINMANGA.StartPageMods();
	} else {
		CERTAINMANGA.StopPageMods();
	}

	var objectStore = CERTAINMANGA.GetObjectStore("options", true);
	objectStore.put({key: "bIsOn", value: status});
};

CERTAINMANGA.ChangeNotificationStatus = function ChangeNotificationStatus(status) {
	CERTAINMANGA.data.bNotifications = status;

	var objectStore = CERTAINMANGA.GetObjectStore("options", true);
	objectStore.put({key: "bNotifications", value: status});
};

CERTAINMANGA.ChangeNetSave = function ChangeNetSave(status) {
	CERTAINMANGA.data.bNetworkSaving = status;

	var objectStore = CERTAINMANGA.GetObjectStore("options", true);
	objectStore.put({key: "bNetworkSaving", value: status});
};

CERTAINMANGA.ChangeDesign = function ChangeDesign(status) {
	CERTAINMANGA.data.bCompactDesign = status;

	var objectStore = CERTAINMANGA.GetObjectStore("options", true);
	objectStore.put({key: "bCompactDesign", value: status});
};

CERTAINMANGA.ChangeShowPageNumber = function ChangeShowPageNumber(status) {
	CERTAINMANGA.data.bShowPageNumbers = status;

	var objectStore = CERTAINMANGA.GetObjectStore("options", true);
	objectStore.put({key: "bShowPageNumbers", value: status});

	CERTAINMANGA.UpdateShowPageNumberWorkers();
};

CERTAINMANGA.ChangeInfiniteScrolling = function ChangeInfiniteScrolling(status) {
	CERTAINMANGA.data.bInfiniteScrolling = status;

	var objectStore = CERTAINMANGA.GetObjectStore("options", true);
	objectStore.put({key: "bInfiniteScrolling", value: status});

	CERTAINMANGA.UpdateInfiniteScrollingWorkers();
};

CERTAINMANGA.ChangeUpdateTime = function ChangeUpdateTime(status) {
	CERTAINMANGA.data.updateTime = status;
	timers.clearTimeout(CERTAINMANGA.updateTimer);
	if (CERTAINMANGA.data.updateTime > 0) {
		CERTAINMANGA.updateTimer = timers.setTimeout(CERTAINMANGA.StartUpdating, CERTAINMANGA.data.updateTime);
	}

	var objectStore = CERTAINMANGA.GetObjectStore("options", true);
	objectStore.put({key: "updateTime", value: status});
};

CERTAINMANGA.ChangeMaxUpdateTime = function ChangeMaxUpdateTime(status) {
	CERTAINMANGA.data.maxUpdateTime = status;

	var objectStore = CERTAINMANGA.GetObjectStore("options", true);
	objectStore.put({key: "maxUpdateTime", value: status});
};

CERTAINMANGA.StartUpdating = function StartUpdating() {
	if (!CERTAINMANGA.bIsUpdating) {
		CERTAINMANGA.bIsUpdating = true;

		CERTAINMANGA.UpdateNextManga();
	}
};

CERTAINMANGA.CreateMainPanel = function CreateMainPanel() {
	CERTAINMANGA.mainPanel = panels.Panel({
		contentURL: self.data.url("main_panel.html"),
		contentScriptFile: self.data.url('main_panel.js'),
		contentStyleFile: self.data.url('main_panel.css'),
		contentScriptOptions: {data: CERTAINMANGA.data, modOpt: CERTAINMANGA.pageModOptions},
		onHide: CERTAINMANGA.HandleHide,
		onShow: CERTAINMANGA.HandleShow,
		width: 512,
		height: 384
	});

	CERTAINMANGA.mainPanel.port.on("OpenTab", CERTAINMANGA.OpenTab);

	CERTAINMANGA.mainPanel.port.on("MarkAsRead", CERTAINMANGA.MarkAsRead);

	CERTAINMANGA.mainPanel.port.on("Remove", CERTAINMANGA.Remove);

	CERTAINMANGA.mainPanel.port.on("ChangeAddonStatus", CERTAINMANGA.ChangeAddonStatus);

	CERTAINMANGA.mainPanel.port.on("ChangeNotificationStatus", CERTAINMANGA.ChangeNotificationStatus);

	CERTAINMANGA.mainPanel.port.on("ChangeNetSave", CERTAINMANGA.ChangeNetSave);

	CERTAINMANGA.mainPanel.port.on("ChangeDesign", CERTAINMANGA.ChangeDesign);

	CERTAINMANGA.mainPanel.port.on("ChangeShowPageNumber", CERTAINMANGA.ChangeShowPageNumber);

	CERTAINMANGA.mainPanel.port.on("ChangeInfiniteScrolling", CERTAINMANGA.ChangeInfiniteScrolling);

	CERTAINMANGA.mainPanel.port.on("ChangeUpdateTime", CERTAINMANGA.ChangeUpdateTime);

	CERTAINMANGA.mainPanel.port.on("ChangeMaxUpdateTime", CERTAINMANGA.ChangeMaxUpdateTime);

	CERTAINMANGA.mainPanel.port.on("StartUpdating", CERTAINMANGA.StartUpdating);
};

CERTAINMANGA.UpdateInfiniteScrollingWorkers = function UpdateInfiniteScrollingWorkers() {
	var count = CERTAINMANGA.workers.length;

	while(count--) {
		CERTAINMANGA.workers[count].port.emit("ChangeInfiniteScrolling", CERTAINMANGA.data.bInfiniteScrolling);
	}
};

CERTAINMANGA.UpdateShowPageNumberWorkers = function UpdateShowPageNumberWorkers() {
	var count = CERTAINMANGA.workers.length;

	while(count--) {
		CERTAINMANGA.workers[count].port.emit("ChangeShowPageNumber", CERTAINMANGA.data.bShowPageNumbers);
	}
};

/**
 * @return {boolean}
 */
CERTAINMANGA.ChaptersEqual = function ChaptersEqual(a, b) {
	if (a.length != b.length) {
		return false;
	}
	for (var i = 0; i < a.length; ++i) {
		if (a[i].name !== b[i].name || a[i].url !== b[i].url) {
			return false;
		}
	}
	return true;
};

CERTAINMANGA.UpdateMangaResponse = function UpdateMangaResponse(newChapters, mangaData) {
	var dateNow = Date.now();
	//console.log(newChapters, mangaData);

	if (newChapters && mangaData) {
		if (!CERTAINMANGA.ChaptersEqual(mangaData.chapters,newChapters)) {

			if (CERTAINMANGA.data.bNotifications) {
				if (notifications === false) {
					notifications = require("sdk/notifications");
				}

				var intNewChapters = newChapters.length - mangaData.chapters.length;
				var nText = "Chapters have been updated";
				var nData = "panel";
				if (intNewChapters == 1) {
					nText = intNewChapters + " new chapter found.";
					nData = newChapters[newChapters.length - 1].url;
				} else if (intNewChapters > 1) {
					nText = intNewChapters + " new chapters found.";
				}

				notifications.notify({
					title: mangaData.name + " has been updated",
					text: nText,
					iconURL: './img/icon-64.png',
					data: nData,
					onClick: function(data) {
						if (nData == "panel") {
							CERTAINMANGA.button.badge = undefined;
							CERTAINMANGA.mainPanel.show({
								position: CERTAINMANGA.button
							});
						} else {
							CERTAINMANGA.button.badge = (CERTAINMANGA.button.badge && CERTAINMANGA.button.badge > 0) ? CERTAINMANGA.button.badge - 1 : undefined;
							CERTAINMANGA.OpenTab(nData);
						}
					}
				});
			}

			mangaData.lastUpdatedAt = dateNow;
			//mangaData.newChapterTimeAt = dateNow;
			mangaData.chapters = newChapters;
			if (mangaData.atChapter != mangaData.chapters[mangaData.chapters.length -1].name) {
				mangaData.bRead = false;
			}
			CERTAINMANGA.UpdateMangaInfo(mangaData);
			CERTAINMANGA.button.badge = (CERTAINMANGA.button.badge == undefined) ? 1 : CERTAINMANGA.button.badge + 1;

			if (mangaData.netSaveTimeIncrease) {
				mangaData.netSaveTimeIncrease = 0;
				mangaData.netSaveTimes = 0;
			}
			//console.log("UPDATED");
		} else {
			//mangaData.lastUpdatedAt = dateNow;

			if (mangaData.netSaveTimeIncrease) {
				mangaData.netSaveTimes++;
				mangaData.netSaveTimeIncrease = dateNow + (CERTAINMANGA.NETSAVEINCREASEBY * mangaData.netSaveTimes);
				if (mangaData.netSaveTimes * CERTAINMANGA.NETSAVEINCREASEBY > CERTAINMANGA.data.maxUpdateTime) {
					mangaData.netSaveTimeIncrease = CERTAINMANGA.data.maxUpdateTime;
					mangaData.netSaveTimes--;
				}
			} else {
				mangaData.netSaveTimeIncrease = dateNow + CERTAINMANGA.NETSAVEINCREASEBY;
				mangaData.netSaveTimes = 1;
			}
			//console.log("NEXT UPDATE PLUS: " + mangaData.netSaveTimes * CERTAINMANGA.NETSAVEINCREASEBY / 1000);
			//console.log("NO UPDATED");
		}
	}

	timers.setTimeout(CERTAINMANGA.UpdateNextManga, 300);
};

CERTAINMANGA.UpdateNextManga = function UpdateNextManga() {
	if (CERTAINMANGA.currentlyUpdating >= CERTAINMANGA.data.mangaList.length) {
		CERTAINMANGA.bIsUpdating = false;
		CERTAINMANGA.currentlyUpdating = 0;

		if (CERTAINMANGA.data.updateTime > 0) {
			CERTAINMANGA.updateTimer = timers.setTimeout(CERTAINMANGA.StartUpdating, CERTAINMANGA.data.updateTime);
		}
		return;
	}

	var mangaTemp;
	if (CERTAINMANGA.data.mangaList[CERTAINMANGA.currentlyUpdating]) {
		mangaTemp = CERTAINMANGA.data.mangaList[CERTAINMANGA.currentlyUpdating];

		if (CERTAINMANGA.data.bNetworkSaving) {
			if (mangaTemp.netSaveTimeIncrease) {
				if (Date.now() <= mangaTemp.netSaveTimeIncrease) {
					CERTAINMANGA.currentlyUpdating++;
					CERTAINMANGA.UpdateNextManga();
					return;
				}
			}
		}

		if (mangaTemp.site == "Batoto") {
			if (batoto === false) {
				batoto = require("./updaters/batoto");
			}
			batoto.RequestUpdate(mangaTemp, CERTAINMANGA.UpdateMangaResponse);
		} else if (mangaTemp.site == "Mangafox") {
			if (mangafox === false) {
				mangafox = require("./updaters/mangafox");
			}
			mangafox.RequestUpdate(mangaTemp, CERTAINMANGA.UpdateMangaResponse);
		} else if (mangaTemp.site == "Mangastream") {
			if (mangastream === false) {
				mangastream = require("./updaters/mangastream");
			}
			mangastream.RequestUpdate(mangaTemp, CERTAINMANGA.UpdateMangaResponse);
		}

		CERTAINMANGA.currentlyUpdating++;
	}
};

/*
	var mangaData = {
		name: CMREADER.options.mangaName,
		site: "Batoto",
		atChapter: CMREADER.options.chapterName,
		chapters: CMREADER.options.chapters,
		bRead: (CMREADER.options.chapterName == CMREADER.options.chapterNumbers[CMREADER.options.chapterNumbers.length - 1]) ? true : false,
		lastUpdatedAt: Date.now()
	};
*/

CERTAINMANGA.UpdateWorkersManga = function UpdateAddToListWorkers(mangaName, mangaSite, bSubscribed) {
	var count = CERTAINMANGA.workers.length;

	while(count--) {
		if (CERTAINMANGA.workers[count].mangaName == mangaName && CERTAINMANGA.workers[count].mangaSite == mangaSite) {
			CERTAINMANGA.workers[count].port.emit("WorkerUpdateSubscribed", bSubscribed);
		}
	}
};

CERTAINMANGA.DetachWorker = function DetachWorker() {
	var count = CERTAINMANGA.workers.length;

	while(count--) {
		if (CERTAINMANGA.workers[count] == this) {
			CERTAINMANGA.workers.splice(count, 1);
		}
	}
};

CERTAINMANGA.StartPageMods = function StartPageMods() {
	CERTAINMANGA.pageMods = {};

	// BATOTO
	CERTAINMANGA.pageMods.batoto = pageMod.PageMod({
		include: /.*bato\.to\/read\/.*/, //"*.bato.to",
		contentScriptFile: [self.data.url("menu.js"), self.data.url("readers/cmreader.js"), self.data.url("readers/batoto.js")],
		contentStyleFile: [self.data.url("menu.css"), self.data.url("readers/cmreader.css"), self.data.url("readers/batoto.css")],
		contentScriptWhen: 'ready',
		contentScriptOptions: CERTAINMANGA.pageModOptions,
		attachTo: "top",
		onAttach: function(worker) {
			worker.port.on("AddToList", CERTAINMANGA.AddToList);
			worker.port.on("RemoveFromList", CERTAINMANGA.RemoveFromList);
			worker.port.on("CheckSubscription", function(data) {
				CERTAINMANGA.CheckSubscription(data, worker);
			});
			worker.port.on("UpdateMangaInfo", CERTAINMANGA.UpdateMangaInfo);
			worker.on('detach', CERTAINMANGA.DetachWorker);

			if (CERTAINMANGA.data.bIsOn) {
				worker.port.emit("StartMain", CERTAINMANGA.bFirstTime);
				if (!CERTAINMANGA.data.bInfiniteScrolling) {
					worker.port.emit("ChangeInfiniteScrolling", CERTAINMANGA.data.bInfiniteScrolling);
				}
				if (CERTAINMANGA.data.bShowPageNumbers) {
					worker.port.emit("ChangeShowPageNumber", CERTAINMANGA.data.bShowPageNumbers);
				}
			}
		}
	});

	//For Testing
	//http://bato.to/read/_/19223/g-edition_ch1_by_cxc-scans

	// MANGAFOX
	CERTAINMANGA.pageMods.mangafox = pageMod.PageMod({
		include: /.*mangafox\.me\/manga\/.*\/.*\/.*/,
		contentScriptFile: [self.data.url("menu.js"), self.data.url("readers/cmreader.js"), self.data.url("readers/mangafox.js")],
		contentStyleFile: [self.data.url("menu.css"), self.data.url("readers/cmreader.css"), self.data.url("readers/mangafox.css")],
		contentScriptWhen: 'ready',
		contentScriptOptions: CERTAINMANGA.pageModOptions,
		attachTo: "top",
		onAttach: function(worker) {
			worker.port.on("AddToList", CERTAINMANGA.AddToList);
			worker.port.on("RemoveFromList", CERTAINMANGA.RemoveFromList);
			worker.port.on("CheckSubscription", function(data) {
				CERTAINMANGA.CheckSubscription(data, worker);
			});
			worker.port.on("UpdateMangaInfo", CERTAINMANGA.UpdateMangaInfo);
			worker.on('detach', CERTAINMANGA.DetachWorker);

			if (CERTAINMANGA.data.bIsOn) {
				worker.port.emit("StartMain", CERTAINMANGA.bFirstTime);
				if (!CERTAINMANGA.data.bInfiniteScrolling) {
					worker.port.emit("ChangeInfiniteScrolling", CERTAINMANGA.data.bInfiniteScrolling);
				}
				if (CERTAINMANGA.data.bShowPageNumbers) {
					worker.port.emit("ChangeShowPageNumber", CERTAINMANGA.data.bShowPageNumbers);
				}
			}
		}
	});

	// MANGASTREAM
	CERTAINMANGA.pageMods.mangastream = pageMod.PageMod({
		include: /.*readms\.com\/r\/.*\/.*/,
		contentScriptFile: [self.data.url("menu.js"), self.data.url("readers/cmreader.js"), self.data.url("readers/mangastream.js")],
		contentStyleFile: [self.data.url("menu.css"), self.data.url("readers/cmreader.css"), self.data.url("readers/mangastream.css")],
		contentScriptWhen: 'ready',
		contentScriptOptions: CERTAINMANGA.pageModOptions,
		attachTo: "top",
		onAttach: function(worker) {
			worker.port.on("AddToList", CERTAINMANGA.AddToList);
			worker.port.on("RemoveFromList", CERTAINMANGA.RemoveFromList);
			worker.port.on("CheckSubscription", function(data) {
				CERTAINMANGA.CheckSubscription(data, worker);
			});
			worker.port.on("UpdateMangaInfo", CERTAINMANGA.UpdateMangaInfo);
			worker.on('detach', CERTAINMANGA.DetachWorker);

			if (CERTAINMANGA.data.bIsOn) {
				worker.port.emit("StartMain", CERTAINMANGA.bFirstTime);
				if (!CERTAINMANGA.data.bInfiniteScrolling) {
					worker.port.emit("ChangeInfiniteScrolling", CERTAINMANGA.data.bInfiniteScrolling);
				}
				if (CERTAINMANGA.data.bShowPageNumbers) {
					worker.port.emit("ChangeShowPageNumber", CERTAINMANGA.data.bShowPageNumbers);
				}
			}
		}
	});
};

CERTAINMANGA.StopPageMods = function StopPageMods() {
	CERTAINMANGA.pageMods.batoto.destroy();
	CERTAINMANGA.pageMods.mangafox.destroy();
	CERTAINMANGA.pageMods.mangastream.destroy();
};

// Initialize Code =====================================================================================================

CERTAINMANGA.OpenDatabase();

CERTAINMANGA.StartAddon = function StartAddon() {
	CERTAINMANGA.CreateMainPanel();
	CERTAINMANGA.button.disabled = false;

	if (CERTAINMANGA.data.bIsOn) {
		CERTAINMANGA.StartPageMods();
	}

	if (CERTAINMANGA.data.updateTime > 0) {
		CERTAINMANGA.updateTimer = timers.setTimeout(CERTAINMANGA.StartUpdating, 30000);
	}
};