import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Search, Upload, Calendar, Shield,
  CheckCircle2, AlertTriangle, Download
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function DocumentVault() {
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  const { data: documents } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.DocumentVault.list('-uploaded_at', 200),
    initialData: [],
  });

  const expiringSoon = documents.filter(d => {
    if (!d.expiration_date) return false;
    const daysUntil = differenceInDays(new Date(d.expiration_date), new Date());
    return daysUntil > 0 && daysUntil <= 30;
  }).length;

  const expired = documents.filter(d => {
    if (!d.expiration_date) return false;
    return new Date(d.expiration_date) < new Date();
  }).length;

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = !searchQuery ||
      doc.document_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_number?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEntity = entityFilter === "all" || doc.entity_type === entityFilter;

    return matchesSearch && matchesEntity;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <FileText className="w-10 h-10 text-purple-600" />
            Document Vault
          </h1>
          <p className="text-gray-600">Centralized document management and compliance tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 border-blue-200">
            <CardContent className="p-6">
              <FileText className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-900">{documents.length}</p>
              <p className="text-sm text-gray-600">Total Documents</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardContent className="p-6">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-green-900">
                {documents.filter(d => d.status === 'active').length}
              </p>
              <p className="text-sm text-gray-600">Active</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200">
            <CardContent className="p-6">
              <Calendar className="w-8 h-8 text-orange-600 mb-2" />
              <p className="text-3xl font-bold text-orange-900">{expiringSoon}</p>
              <p className="text-sm text-gray-600">Expiring Soon</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200">
            <CardContent className="p-6">
              <AlertTriangle className="w-8 h-8 text-red-600 mb-2" />
              <p className="text-3xl font-bold text-red-900">{expired}</p>
              <p className="text-sm text-gray-600">Expired</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="pl-10"
              />
            </div>
          </div>
          <Button className="bg-blue-600">
            <Upload className="w-5 h-5 mr-2" />
            Upload Document
          </Button>
        </div>

        <Card className="border-2 border-gray-200">
          <CardHeader className="bg-gray-50">
            <CardTitle>All Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {filteredDocs.map((doc) => {
                const daysUntilExpiry = doc.expiration_date 
                  ? differenceInDays(new Date(doc.expiration_date), new Date())
                  : null;

                return (
                  <Card key={doc.id} className={`border-2 ${
                    doc.status === 'expired' ? 'border-red-300 bg-red-50' :
                    daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'border-orange-300 bg-orange-50' :
                    'border-gray-200'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-900">{doc.document_name}</h4>
                            <Badge variant="outline">{doc.document_type.replace(/_/g, ' ')}</Badge>
                            <Badge className={
                              doc.status === 'active' ? 'bg-green-600' :
                              doc.status === 'expired' ? 'bg-red-600' :
                              'bg-gray-600'
                            }>
                              {doc.status}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Entity</p>
                              <p className="font-semibold">{doc.entity_name}</p>
                            </div>
                            {doc.document_number && (
                              <div>
                                <p className="text-gray-600">Document #</p>
                                <p className="font-semibold">{doc.document_number}</p>
                              </div>
                            )}
                            {doc.expiration_date && (
                              <div>
                                <p className="text-gray-600">Expires</p>
                                <p className="font-semibold">
                                  {format(new Date(doc.expiration_date), "MMM d, yyyy")}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-gray-600">Uploaded</p>
                              <p className="font-semibold">
                                {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>

                          {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
                            <div className="mt-2 p-2 bg-orange-100 rounded border border-orange-300">
                              <p className="text-sm font-semibold text-orange-900">
                                ⚠️ Expires in {daysUntilExpiry} days
                              </p>
                            </div>
                          )}
                        </div>

                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}