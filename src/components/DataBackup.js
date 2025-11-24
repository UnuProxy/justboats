import React, { useState } from 'react';
import { Download, Database, FileJson, FileSpreadsheet, Check, AlertTriangle, Loader } from 'lucide-react';
import {
  exportAllData,
  downloadJSON,
  downloadExcel,
  validateExportData,
  estimateFileSize
} from '../utils/dataExport';
import { handleError } from '../utils/errorHandling';
import toast from 'react-hot-toast';

const DataBackup = () => {
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [exportData, setExportData] = useState(null);

  const handleExportAll = async () => {
    try {
      setLoading(true);
      toast.loading('Fetching all data from Firebase...', { id: 'export' });

      const data = await exportAllData();
      setExportData(data);
      setLastBackup(new Date().toISOString());

      const validation = validateExportData(data);

      if (!validation.valid) {
        toast.error(validation.error, { id: 'export' });
        return;
      }

      toast.success(
        `Successfully fetched ${data.metadata.totalDocuments} documents from ${data.metadata.exportedCollections} collections`,
        { id: 'export', duration: 5000 }
      );

      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          toast(warning, { icon: '⚠️', duration: 4000 });
        });
      }
    } catch (error) {
      handleError(error, { context: 'export', customMessage: 'Failed to export data' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJSON = () => {
    if (!exportData) {
      toast.error('Please export data first');
      return;
    }

    try {
      downloadJSON(exportData, 'nautiq-backup');
      toast.success('JSON file downloaded successfully');
    } catch (error) {
      handleError(error, { context: 'download', customMessage: 'Failed to download JSON' });
    }
  };

  const handleDownloadExcel = () => {
    if (!exportData) {
      toast.error('Please export data first');
      return;
    }

    try {
      downloadExcel(exportData, 'nautiq-backup');
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      handleError(error, { context: 'download', customMessage: 'Failed to download Excel' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            Data Backup & Export
          </h1>
          <p className="text-gray-600 mt-2">
            Export all your data for backup or analysis
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-900">Important</h3>
            <p className="text-sm text-yellow-800 mt-1">
              Export data regularly to maintain backups. This exports all collections from Firebase.
              Store backups securely as they contain sensitive business data.
            </p>
          </div>
        </div>

        {/* Export Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Export All Data</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Collections to Export</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Bookings, Clients, Boats, Expenses, Orders, Hotels, Collaborators, and more
                </p>
              </div>
              {exportData && (
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">
                    {exportData.metadata.totalDocuments} documents
                  </p>
                  <p className="text-xs text-gray-500">
                    {exportData.metadata.exportedCollections} collections
                  </p>
                </div>
              )}
            </div>

            {lastBackup && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="w-4 h-4 text-green-600" />
                <span>
                  Last export: {new Date(lastBackup).toLocaleString()}
                </span>
              </div>
            )}

            <button
              onClick={handleExportAll}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Export All Data from Firebase
                </>
              )}
            </button>
          </div>
        </div>

        {/* Download Options */}
        {exportData && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Download Formats</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* JSON Download */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileJson className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">JSON Format</h3>
                    <p className="text-xs text-gray-500">
                      {estimateFileSize(exportData)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Complete data structure with nested objects. Best for re-importing or programmatic use.
                </p>
                <button
                  onClick={handleDownloadJSON}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download JSON
                </button>
              </div>

              {/* Excel Download */}
              <div className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileSpreadsheet className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Excel Format</h3>
                    <p className="text-xs text-gray-500">Multi-sheet workbook</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Flattened data in separate sheets. Best for analysis in Excel, viewing, and reporting.
                </p>
                <button
                  onClick={handleDownloadExcel}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Excel
                </button>
              </div>
            </div>

            {/* Export Summary */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Export Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Total Collections</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {exportData.metadata.totalCollections}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Exported Collections</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {exportData.metadata.exportedCollections}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Total Documents</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {exportData.metadata.totalDocuments}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Export Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(exportData.exportDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {exportData.errors && exportData.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm font-medium text-red-800 mb-2">Export Errors:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {exportData.errors.map((err, idx) => (
                      <li key={idx}>
                        {err.collection}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Backup Best Practices</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Export data at least weekly for business continuity</li>
            <li>• Store backups in multiple secure locations (cloud storage, external drive)</li>
            <li>• Test restore procedures periodically</li>
            <li>• JSON format preserves complete data structure for re-importing</li>
            <li>• Excel format is better for human-readable analysis and reporting</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DataBackup;
