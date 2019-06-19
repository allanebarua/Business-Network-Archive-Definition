'use strict';

/**
 * Transaction processor function.
 * @param {org.jphr.network.CreateSummaryMedicalRecord} trans create transaction instance.
 * @transaction
 */
async function CreateSummaryMedicalRecord(trans) {

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
        let assetRegistry = await getAssetRegistry(`${NetworkNamespace}.SummaryMedicalRecord`);
        let newHealthData = getFactory().newResource(NetworkNamespace, 'SummaryMedicalRecord', owner.getIdentifier());

        newHealthData.bloodGroup = healthRecord.bloodGroup;
        newHealthData.allergies = healthRecord.allergies;
        newHealthData.otherInfo = healthRecord.otherInfo;
      	newHealthData.emergencyContacts = healthRecord.emergencyContacts;
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
 * @param {org.jphr.network.ReadSummaryMedicalRecord} trans create transaction instance.
 * @transaction
 */
async function ReadSummaryMedicalRecord(trans) {
    // get all health records
    let healthRecordRegistry  = await getAssetRegistry(`${NetworkNamespace}.SummaryMedicalRecord`);
    let patientRegistry  = await getParticipantRegistry(`${NetworkNamespace}.Patient`);
    var authRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`)
    let allRecords = await healthRecordRegistry.getAll();
    let careProviderId = getCurrentParticipant().getIdentifier();
    var relevantRecords = []


    for (let record of allRecords) {
        const relevantHealthRecord = getFactory().newConcept(NetworkNamespace, 'ReadSummaryMedicalRecordReturn');
        relevantHealthRecord.healthRecord = record;

        if(getCurrentParticipant().getFullyQualifiedType() == `${NetworkNamespace}.Patient`) {
            relevantHealthRecord.accessRights = ['Read', 'Create', 'Update', 'Delete'];
        } else {
            let authBlock = await authRegistry.get(record.owner.getIdentifier());
            let [authorized, accessRights] = await checkAccessRights(authBlock, careProviderId, 'Read');
            relevantHealthRecord.accessRights = accessRights? accessRights : [];
        }
        relevantHealthRecord.owner = await patientRegistry.get(record.owner.getIdentifier())
        relevantRecords.push(relevantHealthRecord)
    }
    console.log(relevantRecords);
    return relevantRecords;
}





/**
 * Transaction processor function.
 * @param {org.jphr.network.UpdateSummaryMedicalRecord} trans create transaction instance.
 * @transaction
 */
async function UpdateSummaryMedicalRecord(trans) {
    // initializing important variables
    var healthRecord = trans.healthRecordUpdate;
    var updatedBy = getCurrentParticipant();

    // get specific HealthRecord
    let healthRecordRegistry = await getAssetRegistry(`${NetworkNamespace}.SummaryMedicalRecord`);
    let previousHealthRecord = await healthRecordRegistry.get(healthRecord.summaryMedicalRecordId);

    try {
        // Participant is patient
        console.log(updatedBy.getIdentifier(), ' ', previousHealthRecord.createdBy.getIdentifier())
        if (updatedBy.getFullyQualifiedType() == `${NetworkNamespace}.Patient`){
            if(updatedBy.getIdentifier() != previousHealthRecord.owner.getIdentifier()){
                throw 'Patient Not Owner'
            }
        }

        // Participant is CareProvider
        else if (updatedBy.getFullyQualifiedType() == `${NetworkNamespace}.CareProvider`){

            let providerIsAuthorized = await checkIfAuthorized('Update', previousHealthRecord.owner, updatedBy)

            if (!providerIsAuthorized) {
                throw 'Not Authorized';
            }
        }

        // set only fields that have been supplied
        previousHealthRecord.bloodGroup = healthRecord.bloodGroup;
        previousHealthRecord.allergies = healthRecord.allergies;
        previousHealthRecord.otherInfo = healthRecord.otherInfo;
        previousHealthRecord.updatedBy = updatedBy;

        await healthRecordRegistry.update(previousHealthRecord);
        return 'success'

    }

    catch(err){
        console.log(err)
        return err
    }
}

