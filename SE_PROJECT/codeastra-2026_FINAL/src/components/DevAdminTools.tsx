import React, { useState } from 'react';
import { useAuth } from '../App';
import { CheckCircleIcon, ExclamationTriangleIcon, Modal } from './common';
import { db as firebaseDb } from '../firebaseConfig';
import { deleteDoc, doc } from 'firebase/firestore';

const DevAdminTools: React.FC = () => {
    const { db, updateAdminState, updateTeam } = useAuth();
    const [working, setWorking] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [devModal, setDevModal] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'info'; message: string }>({ isOpen: false, type: 'info', message: '' });

    const toggleRegistrations = async () => {
        if (!db?.adminState) return;
        setWorking(true);
        try {
            await updateAdminState({ registrations_open: !db.adminState.registrations_open });
        } catch (err) {
            console.error('toggleRegistrations error', err);
        }
        setWorking(false);
    };

    const toggleRound1 = async () => {
        if (!db?.adminState) return;
        setWorking(true);
        try {
            await updateAdminState({ round1_started: !db.adminState.round1_started });
        } catch (err) {
            console.error('toggleRound1 error', err);
        }
        setWorking(false);
    };

    const approveAll = async () => {
        if (!db?.teams?.length) return;
        setWorking(true);
        try {
            await Promise.all(db.teams.map(t => updateTeam(t.id, { status: 'approved' })));
        } catch (err) {
            console.error('approveAll error', err);
        }
        setWorking(false);
    };

    const ensureStatuses = async (status: string = 'pending') => {
        if (!db?.teams?.length) return;
        setWorking(true);
        try {
            await Promise.all(db.teams.filter(t => !t.status).map(t => updateTeam(t.id, { status })));
        } catch (err) {
            console.error('ensureStatuses error', err);
        }
        setWorking(false);
    };

    const resetApp = () => {
        setConfirmOpen(true);
    };

    const performResetApp = async () => {
        setConfirmOpen(false);
        setWorking(true);
        try {
            // Delete teams in batches to avoid overwhelming Firestore
            if (db?.teams?.length) {
                const batchSize = 10;
                for (let i = 0; i < db.teams.length; i += batchSize) {
                    const batch = db.teams.slice(i, i + batchSize);
                    await Promise.all(batch.map(t => deleteDoc(doc(firebaseDb, 'teams', t.id))));
                    console.log(`Deleted batch ${Math.floor(i/batchSize) + 1} of teams`);
                    // Small delay to prevent overwhelming
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                console.log(`Deleted ${db.teams.length} teams total`);
            }

            // Reset admin state with all required fields
            await updateAdminState({
                registrations_open: true,
                round1_started: false,
                round2_started: false,
                round1_finalized: false,
                round2_finalized: false,
                round1_results_visible: false,
                round2_results_visible: false,
                round3_results_visible: false,
                round1_problem: '',
                round2_problem: '',
                round1_questions: [],
                round3_qualifiers_count: 10
            });

            console.log('App reset complete - all teams deleted, all data cleared');
            setDevModal({ isOpen: true, type: 'success', message: '✅ App reset complete! All teams and submissions have been deleted.' });
        } catch (err) {
            console.error('resetApp error', err);
            setDevModal({ isOpen: true, type: 'error', message: '❌ Error during reset: ' + (err as any).message });
        } finally {
            setWorking(false);
        }
    };

    return (
        <div className="p-3 md:p-4 mb-4 rounded-lg border border-brand-primary/30 bg-brand-dark text-xs md:text-sm">
            <h4 className="font-semibold mb-3 text-brand-primary">⚙️ Dev Admin Tools (dev only)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <button onClick={toggleRegistrations} disabled={working} className="px-2 md:px-3 py-2 rounded bg-brand-primary text-brand-dark font-semibold text-xs md:text-sm hover:opacity-80 disabled:opacity-50 transition">Toggle Registrations</button>
                <button onClick={toggleRound1} disabled={working} className="px-2 md:px-3 py-2 rounded bg-brand-primary text-brand-dark font-semibold text-xs md:text-sm hover:opacity-80 disabled:opacity-50 transition">Toggle Round 1</button>
                <button onClick={approveAll} disabled={working} className="px-2 md:px-3 py-2 rounded bg-brand-secondary text-brand-dark font-semibold text-xs md:text-sm hover:opacity-80 disabled:opacity-50 transition">Approve All Teams</button>
                <button onClick={() => ensureStatuses('pending')} disabled={working} className="px-2 md:px-3 py-2 rounded bg-brand-surface text-brand-text font-semibold text-xs md:text-sm hover:opacity-80 disabled:opacity-50 transition">Set Missing → pending</button>
                <button onClick={resetApp} disabled={working} className="px-2 md:px-3 py-2 rounded bg-red-600/80 text-white font-semibold text-xs md:text-sm hover:opacity-80 disabled:opacity-50 transition hover:bg-red-600">Reset App</button>
            </div>
            {working && <p className="text-xs text-brand-primary mt-3 font-semibold">⏳ Working...</p>}
            <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-yellow-500" />
                <h3 className="text-xl font-bold text-yellow-400 mt-4 mb-2">Confirm Reset</h3>
                <p className="text-brand-text-dark">This will delete all teams and clear all submissions/results. Admin settings will be reset. Proceed?</p>
                <div className="mt-6 flex justify-center space-x-4">
                    <button onClick={() => setConfirmOpen(false)} className="bg-brand-surface hover:bg-brand-surface/80 text-white font-bold py-2 px-6 rounded-lg">Cancel</button>
                    <button onClick={performResetApp} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg">Confirm & Reset</button>
                </div>
            </Modal>
            <Modal isOpen={devModal.isOpen} onClose={() => setDevModal({ ...devModal, isOpen: false })}>
                {devModal.type === 'success' ? (
                    <>
                        <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500" />
                        <h3 className="text-xl font-bold text-green-400 mt-4 mb-2">Success</h3>
                        <p className="text-brand-text-dark">{devModal.message}</p>
                        <div className="mt-6 flex justify-center"><button onClick={() => setDevModal({ ...devModal, isOpen: false })} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">OK</button></div>
                    </>
                ) : (
                    <>
                        <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-500" />
                        <h3 className="text-xl font-bold text-red-400 mt-4 mb-2">Error</h3>
                        <p className="text-brand-text-dark">{devModal.message}</p>
                        <div className="mt-6 flex justify-center"><button onClick={() => setDevModal({ ...devModal, isOpen: false })} className="bg-brand-primary text-brand-dark font-bold py-2 px-6 rounded-lg">Close</button></div>
                    </>
                )}
            </Modal>
        </div>
    );
};

export default DevAdminTools;
