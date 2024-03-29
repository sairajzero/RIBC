(function () {
    const Ribc = window.RIBC = {};
    const Admin = Ribc.admin = {};

    Ribc.init = function (isSubAdmin = false) {
        return new Promise((resolve, reject) => {
            Ribc.refreshGeneralData(isSubAdmin)
                .then(results => resolve(results))
                .catch(error => reject(error))
        })
    }

    Ribc.refreshObjectData = () => {
        return new Promise((resolve, reject) => {
            floCloudAPI.requestObjectData("RIBC").then(result => {
                if (!floGlobals.appObjects.RIBC)
                    floGlobals.appObjects.RIBC = {};
                var objectList = ["projectMap", "projectBranches", "projectTaskDetails", "projectDetails", "internList", "internRating", "internsAssigned", "projectTaskStatus"]
                objectList.forEach(obj => {
                    if (!floGlobals.appObjects.RIBC[obj])
                        floGlobals.appObjects.RIBC[obj] = {};
                    _[obj] = floGlobals.appObjects.RIBC[obj];
                });
                //_.projectMap = floGlobals.appObjects.RIBC.projectMap;
                //this.lastCommit = JSON.stringify(floGlobals.appObjects.RIBC);
                resolve('Object Data Refreshed Successfully')
            }).catch(error => reject(error))
        })
    }

    Ribc.refreshGeneralData = (isSubAdmin) => {
        return new Promise((resolve, reject) => {
            var generalDataList = ["InternUpdates"],
                subAdminOnlyList = [],
                selfOnlyList = [];
            (isSubAdmin ? generalDataList : selfOnlyList).push("TaskRequests", "InternRequests");
            let promises = [];
            for (let data of generalDataList)
                promises.push(floCloudAPI.requestGeneralData(data))
            for (let data of subAdminOnlyList)
                promises.push(floCloudAPI.requestGeneralData(data, {
                    senderID: floGlobals.subAdmins
                }));
            for (let data of selfOnlyList)
                promises.push(floCloudAPI.requestGeneralData(data, {
                    senderID: floDapps.user.id
                }));
            Promise.all(promises)
                .then(results => resolve('General Data Refreshed Successfully'))
                .catch(error => reject(error))
        })
    }

    const _ = {}; //private variable holder

    Ribc.applyForIntern = (name, comments = '') => new Promise((resolve, reject) => {
        floCloudAPI.sendGeneralData([name, comments], "InternRequests")
            .then(results => resolve(results))
            .catch(error => reject(error))
    });

    Ribc.postInternUpdate = (updates) => new Promise((resolve, reject) => {
        floCloudAPI.sendGeneralData(updates, "InternUpdates")
            .then(results => resolve(results))
            .catch(error => reject(error))
    });

    Ribc.getInternUpdates = function (count = null) {
        let internUpdates = Object.values(floGlobals.generalDataset("InternUpdates")).map(data => {
            return {
                floID: data.senderID,
                update: data.message,
                time: data.vectorClock.split('_')[0],
                note: data.note
            }
        })
        internUpdates = internUpdates.filter(data => data.floID in _.internList)
        internUpdates.reverse()
        if (count && count < internUpdates.length)
            internUpdates = internUpdates.slice(0, count)
        return internUpdates;
    }

    Admin.commentInternUpdate = (vectorClock, comment) => new Promise((resolve, reject) => {
        if (!(vectorClock in floGlobals.generalDataset("InternUpdates")))
            return reject("Intern update not found");
        floCloudAPI.noteApplicationData(vectorClock, comment)
            .then(result => resolve(result))
            .catch(error => reject(error))
    });

    Ribc.applyForTask = (projectCode, branch, task, comments = '') => new Promise((resolve, reject) => {
        floCloudAPI.sendGeneralData([projectCode, branch, task, comments], "TaskRequests")
            .then(result => resolve(result))
            .catch(error => reject(error))
    });

    Ribc.getProjectList = () => Object.keys(_.projectMap);
    Ribc.getProjectDetails = (project) => _.projectDetails[project];
    Ribc.getProjectMap = (project) => _.projectMap[project];
    Ribc.getProjectBranches = (project) => findAllBranches(project);
    Ribc.getTaskDetails = (project, branch, task) => _.projectTaskDetails[project + "_" + branch + "_" + task];
    Ribc.getTaskStatus = (project, branch, task) => _.projectTaskStatus[project + "_" + branch + "_" + task];
    Ribc.getInternList = () => _.internList;
    Ribc.getInternRating = (floID) => _.internRating[floID];
    Ribc.getAssignedInterns = (projectCode, branch, taskNumber) => _.internsAssigned[projectCode + "_" + branch + "_" + taskNumber]
    Ribc.getAllTasks = () => _.projectTaskDetails
    // Ribc.updateProjectIds = () => {
    //     for (const projectKey in _.projectTaskStatus) {
    //         const splitTaskKey = projectKey.split("_")
    //         updateObjectKey(_.projectTaskStatus, projectKey, splitTaskKey.slice(0, 3).join("-") + '_' + splitTaskKey.slice(3).join('_'))
    //     }
    // }
    // Ribc.showProjectMap = () => {
    //     for (const projectKey in _.projectTaskStatus) {
    //         console.log(projectKey)
    //     }
    // }

    // function updateObjectKey(object, oldKey, newKey) {
    //     if (oldKey !== newKey) {
    //         Object.defineProperty(object, newKey,
    //             Object.getOwnPropertyDescriptor(object, oldKey));
    //         delete object[oldKey];
    //     }
    // }

    Admin.updateObjects = () => new Promise((resolve, reject) => {
        floCloudAPI.updateObjectData("RIBC")
            .then(result => resolve(result))
            .catch(error => reject(error))
    });

    Admin.resetObjects = () => new Promise((resolve, reject) => {
        floCloudAPI.resetObjectData("RIBC")
            .then(result => resolve(result))
            .catch(error => reject(error))
    });

    Admin.addProjectDetails = function (projectCode, details) {
        if (!(projectCode in _.projectMap))
            return "Project not Found!";
        if (projectCode in _.projectDetails && typeof projectCode === 'object' && typeof details === 'object')
            for (let d in details)
                _.projectDetails[projectCode][d] = details[d];
        else
            _.projectDetails[projectCode] = details;
        return "added project details for " + projectCode;
    }

    Ribc.getInternRequests = function (ignoreProcessed = true) {
        var internRequests = Object.values(floGlobals.generalDataset("InternRequests")).map(data => {
            return {
                floID: data.senderID,
                vectorClock: data.vectorClock,
                name: data.message[0],
                comments: data.message[1],
                status: data.note
            }
        })
        //filter existing interns
        internRequests = internRequests.filter(data => !(data.floID in _.internList))
        //filter processed requests
        if (ignoreProcessed)
            internRequests = internRequests.filter(data => !data.status);
        return internRequests;
    }

    Admin.processInternRequest = function (vectorClock, accept = true) {
        let request = floGlobals.generalDataset("InternRequests")[vectorClock];
        if (!request)
            return "Request not found";
        var status;
        if (accept && addIntern(request.senderID, request.message[0]))
            status = "Accepted";
        else
            status = "Rejected";
        floCloudAPI.noteApplicationData(vectorClock, status).then(_ => null).catch(e => console.error(e))
        return status;
    }

    const addIntern = Admin.addIntern = function (floID, internName) {
        if (floID in _.internList)
            return false
        _.internList[floID] = internName
        _.internRating[floID] = 1
        return true;
    }

    Admin.updateInternRating = function (floID, change = 0) {
        if (!(floID in _.internList))
            return "Intern not found!"
        _.internRating[floID] += change
        return "Intern rating Updated";
    }

    Ribc.getTaskRequests = function (ignoreProcessed = true) {
        var taskRequests = Object.values(floGlobals.generalDataset("TaskRequests")).map(data => {
            return {
                floID: data.senderID,
                vectorClock: data.vectorClock,
                projectCode: data.message[0],
                branch: data.message[1],
                task: data.message[2],
                comments: data.message[3],
                status: data.note
            }
        })
        //filter only intern requests
        taskRequests = taskRequests.filter(data => data.floID in _.internList)
        //filter processed requests
        if (ignoreProcessed)
            taskRequests = taskRequests.filter(data => !data.status)
        return taskRequests
    }

    Admin.processTaskRequest = function (vectorClock, accept = true) {
        let request = floGlobals.generalDataset("TaskRequests")[vectorClock];
        if (!request)
            return "Request not found";
        var status;
        if (accept && assignInternToTask(request.senderID, request.message[0], request.message[1], request.message[2]))
            status = "Accepted";
        else
            status = "Rejected";
        floCloudAPI.noteApplicationData(vectorClock, status).then(_ => null).catch(e => console.error(e))
        return status;
    }

    const assignInternToTask = Admin.assignInternToTask = function (floID, projectCode, branch, taskNumber) {
        var index = projectCode + "_" + branch + "_" + taskNumber
        if (!Array.isArray(_.internsAssigned[index]))
            _.internsAssigned[index] = []
        if (!_.internsAssigned[index].includes(floID)) {
            _.internsAssigned[index].push(floID)
            return true
        } else
            return false
    }

    Admin.unassignInternFromTask = function (floID, projectCode, branch, taskNumber) {
        const index = projectCode + "_" + branch + "_" + taskNumber
        _.internsAssigned[index] = _.internsAssigned[index].filter(id => id != floID)
    }

    Admin.putTaskStatus = function (taskStatus, projectCode, branch, taskNumber) {
        _.projectTaskStatus[projectCode + "_" + branch + "_" + taskNumber] = taskStatus;
    };

    Admin.createProject = function (projectCode) {
        if (projectCode in _.projectMap) {
            return "Project Name already exists";
        }
        addBranch(projectCode);
        return "Project Create: " + projectCode
    }

    Admin.copyBranchtoNewProject = function (oldProjectCode, oldBranch, newProjectCode, newBranchConnection,
        newStartPoint, newEndPoint) {
        //Make sure new branch is a new text string that does not exist in new project
        if (oldBranch == "mainLine") {
            return "You cannot change mainLine";
        }
        if (_.projectMap.hasOwnProperty(newProjectCode) == false) {
            return "The project does not exist"
        }
        if (_.projectMap[newProjectCode].hasOwnProperty(newBranch) == false) {
            return "The branch does not exist"
        }
        if (newStartPoint > newEndPoint) {
            return "Startpoint cannot be later than endpoint"
        }

        var newBranch = addBranch(newProjectCode, newBranchConnection, newStartPoint, newEndPoint);
        _.projectMap[newProjectCode][newBranch] = _.projectMap[oldProjectCode][oldBranch].slice();


        if (newBranchConnection == "undefined") {
            _.projectMap[newProjectCode][newBranch][0] = "mainLine";
        } else {
            _.projectMap[newProjectCode][newBranch][0] = "newBranchConnection";
        }
        if (newStartPoint != "undefined") {
            _.projectMap[newProjectCode][newBranch][2] = newStartPoint;
        }
        if (newEndPoint != "undefined") {
            _.projectMap[newProjectCode][newBranch][3] = newEndPoint;
        }

        //Add entry in _.projectBranches.This may not be needed now
        //_.projectBranches[newProjectCode] = _.projectBranches[newProjectCode]+","+newBranch;

        //Copy Task List too
        var p = _.projectTaskDetails;
        for (var key in p) {
            if (p.hasOwnProperty(key)) {
                if (key.contains(oldProjectCode + "_" + oldBranch)) {
                    var numberExtract = key.replace(oldProjectCode + "_" + oldBranch + "_", "");
                    _.projectTaskDetails[newProjectCode + "_" + newBranch + "_" + numberExtract] = p[key];
                }
            }
        }
        return _.projectMap[newProjectCode][newBranch];
    }

    Admin.deleteTaskInMap = function (projectCode, branch, taskNumber) {
        var arr = _.projectMap[projectCode][branch];
        var currentIndex;
        for (var i = 4; i < arr.length; i++) {
            if (arr[i] == taskNumber) {
                currentIndex = i
            };
        }

        var nextIndex = currentIndex + 1,
            previousIndex = currentIndex - 1;
        var nextTaskNumber = _.projectMap[projectCode][branch][nextIndex],
            previousTaskNumber = _.projectMap[projectCode][branch][previousIndex];

        var deleteMode;
        if (currentIndex == (arr.length - 1)) {
            deleteMode = "last"
        };
        if (currentIndex == 4) {
            deleteMode = "first"
        };
        if ((currentIndex > 4) && (currentIndex < (arr.length - 1))) {
            deleteMode = "normal"
        };
        if ((currentIndex == 4) && (currentIndex == (arr.length - 1))) {
            deleteMode = "nothingToDelete"
        };

        //Checking for links elsewhere 
        var otherBranches = Object.keys(_.projectMap[projectCode]);
        //Remove the native branch and mainLine from otherBranches list
        // otherBranches.splice(otherBranches.indexOf(branch), 1);
        // otherBranches.splice(otherBranches.indexOf("mainLine"), 1);
        otherBranches = otherBranches.filter(currBranch => currBranch !== branch || currBranch !== "mainLine");

        //Checking the link other branches
        for (var i = 0; i < otherBranches.length; i++) {
            if (_.projectMap[projectCode][otherBranches[i]][2] == taskNumber) {
                if (deleteMode == "normal") {
                    _.projectMap[projectCode][otherBranches[i]][2] = previousTaskNumber
                } else if (deleteMode == "last") {
                    _.projectMap[projectCode][otherBranches[i]][2] = previousTaskNumber
                } else if (deleteMode == "first") {
                    _.projectMap[projectCode][otherBranches[i]][2] = nextTaskNumber
                } else if (deleteMode == "undefined") {
                    return " nothing to delete"
                }
            }
            if (_.projectMap[projectCode][otherBranches[i]][3] == taskNumber) {
                if (deleteMode == "normal") {
                    _.projectMap[projectCode][otherBranches[i]][3] = nextTaskNumber
                } else if (deleteMode == "last") {
                    _.projectMap[projectCode][otherBranches[i]][3] = previousTaskNumber
                } else if (deleteMode == "first") {
                    _.projectMap[projectCode][otherBranches[i]][3] = nextTaskNumber
                } else if (deleteMode == "undefined") {
                    return " nothing to delete"
                }
            }
        } //end for loop

        //Delete from other databases
        var p = _.projectTaskDetails;
        for (var key in p) {
            if (p.hasOwnProperty(key)) {
                if (key == projectCode + "_" + branch + "_" + taskNumber) {
                    delete p[key]
                }
            }
        } // end function
        //Now splice the element
        arr.splice(currentIndex, 1);
        arr[1] = arr[1] - 1;
    }

    Admin.insertTaskInMap = function (projectCode, branchName, insertPoint) {
        var lastTasks = [];
        lastTasks = findLastTaskNumber(projectCode);
        var lastNumber = lastTasks[branchName];
        var arr = _.projectMap[projectCode][branchName];
        var addedTaskNumber = lastNumber + 1;
        var insertIndex = 0;

        //Find insert point index
        for (var i = 4; i < arr.length; i++) {
            if (arr[i] >= addedTaskNumber) {
                addedTaskNumber = arr[i] + 1
            }
            if (arr[i] == insertPoint) {
                insertIndex = i;
            }
        }

        if (insertIndex > 3) {
            arr.splice((insertIndex + 1), 0, addedTaskNumber);
            arr[1]++;
        } else {
            return "Not possible to insert here.Try another position"
        }

        return addedTaskNumber;
    }


    //The best error management I have done
    //Project changing is overdoing right now
    //newStartPoint,newEndPoint is optional
    Admin.changeBranchLine = function (projectCode, branch, newConnection, newStartPoint, newEndPoint) {
        //find the task number on the original line where it was branched, and then close the line there
        //Do some basic tests
        if (branch == "mainLine") {
            return "You cannot change mainLine";
        }
        if (_.projectMap.hasOwnProperty(projectCode) == false) {
            return "The project does not exist"
        }
        if (_.projectMap[projectCode].hasOwnProperty(branch) == false) {
            return "The branch does not exist"
        }
        if (_.projectMap[projectCode].hasOwnProperty(newConnection) == false) {
            return "The newConnection does not exist"
        }
        if (newStartPoint > newEndPoint) {
            return "Startpoint cannot be later than endpoint"
        }

        _.projectMap[projectCode][branch][0] = newConnection;
        if (newStartPoint != "undefined") {
            _.projectMap[projectCode][branch][2] = newStartPoint;
        }
        if (newEndPoint != "undefined") {
            _.projectMap[projectCode][branch][3] = newEndPoint;
        }

        return _.projectMap[projectCode][branch];
    }

    //startOrEndOrNewProject 1=>Start,2=>End .. projectCode and branch will remain same .. mainLines cannot be rerouted
    //One test is missing .. you cannot connect to a point after end of connected trunk .. do it later .. not critical  
    Admin.changeBranchPoint = function (projectCode, branch, newPoint, startOrEnd) {
        var message;

        if (branch != "mainLine") {
            if (startOrEnd == 1) {
                if (newPoint <= _.projectMap[projectCode][branch][3]) {
                    _.projectMap[projectCode][branch][2] = newPoint;
                    message = newPoint;
                } else {
                    message = "Start point cannot be later than end point"
                }
            }
            if (startOrEnd == 2) {
                if (newPoint >= _.projectMap[projectCode][branch][2]) {
                    _.projectMap[projectCode][branch][3] = newPoint;
                    message = newPoint;
                } else {
                    message = "End point cannot be earlier than start point"
                }
            }
        }
        if (branch == "mainLine") {
            message = "mainLine cannot be rerouted"
        }
        return message;
    }

    const addBranch = Admin.addBranch = function (projectCode1, branch, startPoint, mergePoint) {
        var arr = findAllBranches(projectCode1);
        var newBranchName;

        if (arr == false) {
            _.projectMap[projectCode1] = {};
            _.projectMap[projectCode1]["mainLine"] = ["mainLine", 0, "Start", "Stop"];
            newBranchName = "mainLine";
            _.projectBranches[projectCode1] = "mainLine";
            //projectCode[projectCode.length] = projectCode1;
        } else {
            var str = arr[arr.length - 1];

            if (str.includes("branch")) {
                var res = str.split("branch");
                var newNumber = parseFloat(res[1]) + 1;
                newBranchName = "branch" + newNumber;
                _.projectMap[projectCode1]["branch" + newNumber] = [branch, 0, startPoint, mergePoint];
                _.projectBranches[projectCode1] = _.projectBranches[projectCode1] + "," + "branch" +
                    newNumber;
            }

            if (str.includes("mainLine")) {
                newBranchName = "branch1";
                _.projectMap[projectCode1]["branch1"] = ["mainLine", 0, startPoint, mergePoint];
                _.projectBranches[projectCode1] = "mainLine,branch1";
            }
        }
        return newBranchName;
    }

    Admin.editTaskDetails = function (taskDetails, projectCode, branch, taskNumber) {
        //add taskDetails
        _.projectTaskDetails[projectCode + "_" + branch + "_" + taskNumber] = { ..._.projectTaskDetails[projectCode + "_" + branch + "_" + taskNumber], ...taskDetails };
    }

    Admin.addTaskInMap = function (projectCode, branchName) {
        var lastTasks = [];
        lastTasks = findLastTaskNumber(projectCode);
        var lastNumber = lastTasks[branchName];

        var addedTaskNumber = lastNumber + 1;
        _.projectMap[projectCode][branchName].push(addedTaskNumber);
        _.projectMap[projectCode][branchName][1]++;

        return addedTaskNumber
    }

    function findAllBranches(projectCode) {
        if (_.projectBranches.hasOwnProperty(projectCode)) {
            var branch = _.projectBranches[projectCode].split(",");
        } else branch = false;

        return branch;
    }

    function findLastTaskNumber(projectCode) {
        var returnData = {};
        //Find all branch lines
        var branch = _.projectBranches[projectCode].split(",");
        for (var i = 0; i < branch.length; i++) {
            returnData[branch[i]] = _.projectMap[projectCode][branch[i]][1];
            //This test seems to have become redundant
            if (returnData[branch[i]] == "Stop") {
                returnData[branch[i]] = 0
            }
        }
        return returnData;
    }

})();