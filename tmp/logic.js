'use strict';

const NetworkNamespace = 'org.jphr.network';

/**
 * Transaction processor function.
 * @param {org.jphr.network.CreateHealthRecord} trans create transaction instance.
 * @transaction
 */
async function CreateHealthRecord(trans) {

    // Data to be stored
    var healthRecord = trans.newHealthRecord;

    // Check that the participant is either a patient or careProvider
    var createdBy = getCurrentParticipant();
    var owner;

    try {
        // Participant is patient
        if (createdBy.getFullyQualifiedType() == `${NetworkNamespace}.Patient`){
          owner = createdBy;
        }

        // Record created by a careProvider
        else if (createdBy.getFullyQualifiedType() == `${NetworkNamespace}.CareProvider`){
			owner = healthRecord.owner
          	// get specific AuthorizationBlock
            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.get(healthRecord.owner.getIdentifier());

            // Check if the careprovider is authorized to create
            let authorizedProviders = authorizationBlock.authorization;
            var providerIsAuthorized = false;

            authorizedProviders.forEach((element) => {
                if (element.careProviderId == getCurrentParticipant().email &&
                    element.accessRights.includes('Create')) {
                        providerIsAuthorized = true;
                }

            })

            if (!providerIsAuthorized){
                throw 'Not Authorized';
            }
        }
      
       	// Get asset registry
        let assetRegistry = await getAssetRegistry(`${NetworkNamespace}.HealthRecord`);
        let newHealthData = getFactory().newResource(NetworkNamespace, 'HealthRecord', healthRecord.healthRecordId);

        newHealthData.diagnosis = healthRecord.diagnosis;
        newHealthData.procedure = healthRecord.procedure;
        newHealthData.treatment = healthRecord.treatment;
        newHealthData.owner = owner;
        newHealthData.createdBy = createdBy;

        await assetRegistry.add(newHealthData);
        return 'success'
    }
    catch(err){
        console.log(err)
        return err
    }
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.UpdateHealthRecord} trans create transaction instance.
 * @transaction
 */
async function UpdateHealthRecord(trans) {
    // initializing important variables
    var healthRecord = trans.healthRecordUpdate;
    var updatedBy = getCurrentParticipant();

    // get specific HealthRecord
    let healthRecordRegistry = await getAssetRegistry(`${NetworkNamespace}.HealthRecord`);
    let previousHealthRecord = await healthRecordRegistry.get(healthRecord.healthRecordId);

    try {
        // Participant is patient
        console.log(updatedBy.getIdentifier(), ' ', previousHealthRecord.createdBy.getIdentifier())
        if (updatedBy.getFullyQualifiedType() == `${NetworkNamespace}.Patient`){
            if(updatedBy.getIdentifier() != previousHealthRecord.owner.getIdentifier()){
                throw 'Patient Not Owner'
            }
            
          	if(updatedBy.getIdentifier() != previousHealthRecord.createdBy.getIdentifier()) {
                throw 'Patient not creator of the record'
            }
        }

        // Participant is CareProvider
        else if (updatedBy.getFullyQualifiedType() == `${NetworkNamespace}.CareProvider`){

            let providerIsAuthorized = await checkIfAuthorized('Update', previousHealthRecord.owner, updatedBy)

            if (!providerIsAuthorized) {
                throw 'Not Authorized';
            }
            if (updatedBy.getIdentifier() != previousHealthRecord.createdBy.getIdentifier() && previousHealthRecord.createdBy.getFullyQualifiedType() == `${NetworkNamespace}.CareProvider`) {
                throw 'Provider not creator of the record'
            }
        }

        // set only fields that have been supplied
        previousHealthRecord.diagnosis = healthRecord.diagnosis;
        previousHealthRecord.procedure = healthRecord.procedure;
        previousHealthRecord.treatment = healthRecord.treatment;
        previousHealthRecord.updatedBy = updatedBy;

        await healthRecordRegistry.update(previousHealthRecord);
        return 'success'

    }

    catch(err){
        console.log(err)
        return err
    }
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.ManageAuthorization} trans create transaction instance.
 * @transaction
 */
async function ManageAuthorization(trans) {
    let action = trans.action;

    try {
        /* Creating Authorization block */
        if(action == 'Create') {
            var owner = getCurrentParticipant();

            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.exists(owner.getIdentifier());

            if(authorizationBlock){
                throw 'Exists'
            }

            let newAuthorizationBlock = getFactory().newResource(NetworkNamespace, 'AuthorizationBlock', owner.getIdentifier());
            newAuthorizationBlock.owner = owner;
            newAuthorizationBlock.authorization = trans.authBlock.authorization;

            await authorizationBlockRegistry.add(newAuthorizationBlock);
            return 'success'
        }

        /* Grant Access */
        else if (action == 'Grant') {
            let authBlock = trans.authBlock;
            let grantee = trans.authBlock.authorization[0].careProviderId;
            let owner = getCurrentParticipant();

            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.get(owner.getIdentifier());

            authBlock.authorization[0].careProviderId = grantee

            authorizationBlock.authorization.push(authBlock.authorization[0])

            await authorizationBlockRegistry.update(authorizationBlock);
            return 'success'

        }

        /* Revoke Access */
        else if (action == 'Revoke') {
            let owner = getCurrentParticipant();

            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.get(owner.getIdentifier());

            let revokedAuthorization = trans.authBlock.authorization[0].careProviderId;

            let revokeIndex =await getAuthIndex(authorizationBlock, revokedAuthorization);

            if (revokeIndex == -1){
                throw 'Not Found'
            }

            authorizationBlock.authorization.splice(revokeIndex, 1)

            await authorizationBlockRegistry.update(authorizationBlock);
            return 'success'
        }

        /* Update Access rights */
        else if (action == 'UpdateAccessRights') {
            let owner = getCurrentParticipant();

            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.get(owner.getIdentifier());

            let revokedAuthorization = trans.authBlock.authorization[0].careProviderId
            console.log(revokedAuthorization)
            let authIndex =await getAuthIndex(authorizationBlock, revokedAuthorization);

            if (authIndex == -1){
                throw 'Not Found'
            }
          console.log(authIndex, ' ' , authorizationBlock.authorization[authIndex])

            authorizationBlock.authorization[authIndex].accessRights = trans.authBlock.authorization[0].accessRights;
            await authorizationBlockRegistry.update(authorizationBlock);
            return 'success'
        }

    }
    catch(err){
      console.log(err);
      return err;
    }
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.ReadHealthRecords} trans create transaction instance.
 * @transaction
 */
async function ReadHealthRecords(trans) {
    // get all health records
    let healthRecordRegistry  = await getAssetRegistry(`${NetworkNamespace}.HealthRecord`);
    var authRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
    let allRecords = await healthRecordRegistry.getAll();
    let careProviderId = getCurrentParticipant().getIdentifier();
    var relevantRecords = []

    for (i=0; i<allRecords.length; i++) {
    	 let authBlock = await authRegistry.get(allRecords[i].owner.getIdentifier());
      	 let authorized = await checkAccessRights(authBlock, careProviderId, 'Read');
         if(authorized) {
            relevantRecords.push(allRecords[i])
         }
    }

    console.log(relevantRecords);
    return relevantRecords
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.DeleteHealthRecord} trans Health Record id.
 * @transaction
 */
async function DeleteHealthRecord(trans) {
    // get Health Record, Check Authorization, Delete if necessary
    let healthRecordRegistry  = await getAssetRegistry(`${NetworkNamespace}.HealthRecord`);
    let authRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
    let healthRecord = await healthRecordRegistry.get(trans.healthRecordId);
    let authBlock = await authRegistry.get(healthRecord.owner.getIdentifier());
    let careProviderId = getCurrentParticipant().getIdentifier();
    let authorized = await checkAccessRights(authBlock, careProviderId, 'Delete')
    if (authorized) {
        await healthRecordRegistry.remove(healthRecord)
      	return 'Success'
    }
  	return 'Not Authorized'
}


/** 
 * Helpers
*/
async function checkIfAuthorized(accessRight, owner, currentParticipant){
    // get specific AuthorizationBlock
    let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
    let authorizationBlock = await authorizationBlockRegistry.get(owner.getIdentifier());

    // Check if the careprovider is authorized to create
    let authorizedProviders = authorizationBlock.authorization;
    var providerIsAuthorized = false;

    authorizedProviders.forEach((element) => {
        if (element.careProviderId == currentParticipant.email &&
            element.accessRights.includes(accessRight)) {
                providerIsAuthorized = true;
        }
    })

    return providerIsAuthorized
}


async function checkAccessRights(authBlock, careProviderId, accessRight) {
    var authorized = false;
    
    authBlock.authorization.forEach((element, index) => {
        if (element.careProviderId == careProviderId){
            if(element.accessRights.includes(accessRight)) {
                authorized = true;
            }
        }
    })

    return authorized;
}


async function getAuthIndex(authorizationBlock, careProviderId) {
    var authIndex = -1
  authorizationBlock.authorization.forEach((element, index) => {
      if (element.careProviderId == careProviderId){
        console.log(element.careProviderId, ' ', careProviderId, ' ', index)
        authIndex = index;
      }
  })

  return authIndex;
}