'use strict';

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
                if (element.careProviderId == getCurrentParticipant().getIdentifier() &&
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
        newHealthData.symptoms = healthRecord.symptoms;
        newHealthData.treatment = healthRecord.treatment;
        newHealthData.dateCreated = healthRecord.dateCreated;
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
        previousHealthRecord.symptoms = healthRecord.symptoms;
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
 * @param {org.jphr.network.ReadHealthRecords} trans create transaction instance.
 * @transaction
 */
async function ReadHealthRecords(trans) {
    // get all health records
    let healthRecordRegistry  = await getAssetRegistry(`${NetworkNamespace}.HealthRecord`);
    let patientRegistry  = await getParticipantRegistry(`${NetworkNamespace}.Patient`);
    var authRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
    let allRecords = await healthRecordRegistry.getAll();
    let careProviderId = getCurrentParticipant().getIdentifier();
    var relevantRecords = []
    
    if (getCurrentParticipant().getFullyQualifiedType() == `${NetworkNamespace}.Patient`) {
        for (let i=0; i< allRecords.length; i++) {
          const relevantHealthRecord = getFactory().newConcept(NetworkNamespace, 'ReadHealthRecordReturn');
          relevantHealthRecord.healthRecord = allRecords[i];
          relevantHealthRecord.accessRights = ['Read', 'Create', 'Update', 'Delete'];
          relevantHealthRecord.owner = await patientRegistry.get(allRecords[i].owner.getIdentifier())
          relevantRecords.push(relevantHealthRecord);
        }
        console.log(relevantRecords);
    	return relevantRecords;
    }

    for (i=0; i<allRecords.length; i++) {
    	 let authBlock = await authRegistry.get(allRecords[i].owner.getIdentifier());
      	 let [authorized, accessRights] = await checkAccessRights(authBlock, careProviderId, 'Read');
         if(authorized) {
            const relevantHealthRecord = getFactory().newConcept(NetworkNamespace, 'ReadHealthRecordReturn');
            relevantHealthRecord.healthRecord = allRecords[i];
            relevantHealthRecord.accessRights = accessRights;
            relevantHealthRecord.owner = await patientRegistry.get(allRecords[i].owner.getIdentifier())
            relevantRecords.push(relevantHealthRecord)
            console.log(relevantRecords)
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
  
  	if (getCurrentParticipant().getFullyQualifiedType() == `${NetworkNamespace}.Patient`) {
    	await healthRecordRegistry.remove(healthRecord)
        return 'Success'
    }
    let authBlock = await authRegistry.get(healthRecord.owner.getIdentifier());
    let careProviderId = getCurrentParticipant().getIdentifier();
    let [authorized, accessRights] = await checkAccessRights(authBlock, careProviderId, 'Delete')
    if (authorized) {
        await healthRecordRegistry.remove(healthRecord)
      	return 'Success'
    }
  	return 'Not Authorized'
}