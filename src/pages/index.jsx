import Layout from "./Layout.jsx";

import CarrierDashboard from "./CarrierDashboard";

import CustomerPortal from "./CustomerPortal";

import BusinessSenderDashboard from "./BusinessSenderDashboard";

import BinManagementPage from "./BinManagementPage";

import DriverMobile from "./DriverMobile";

import DispatchDashboard from "./DispatchDashboard";

import BatchPackageEntry from "./BatchPackageEntry";

import AnalyticsDashboard from "./AnalyticsDashboard";

import PackageManagement from "./PackageManagement";

import LabelDesigner from "./LabelDesigner";

import InventoryManagement from "./InventoryManagement";

import DriverManagement from "./DriverManagement";

import HOSManagement from "./HOSManagement";

import DOTCompliance from "./DOTCompliance";

import LoadManagement from "./LoadManagement";

import FleetMaintenance from "./FleetMaintenance";

import DriverNavigation from "./DriverNavigation";

import MailboxManagement from "./MailboxManagement";

import USPSManagement from "./USPSManagement";

import CustomerCommunication from "./CustomerCommunication";

import CustomerMessageDashboard from "./CustomerMessageDashboard";

import AdminControl from "./AdminControl";

import FleetMap from "./FleetMap";

import RoutePlanning from "./RoutePlanning";

import PaymentCenter from "./PaymentCenter";

import ReportsHub from "./ReportsHub";

import IncidentManagement from "./IncidentManagement";

import DocumentVault from "./DocumentVault";

import SystemSettings from "./SystemSettings";

import CustomerSelfService from "./CustomerSelfService";

import Home from "./Home";

import NotificationCenter from "./NotificationCenter";

import CreateShippingLabel from "./CreateShippingLabel";

import BulkOperations from "./BulkOperations";

import HelpCenter from "./HelpCenter";

import AutomationHub from "./AutomationHub";

import TrainingPortal from "./TrainingPortal";

import PublicTracking from "./PublicTracking";

import DriverExpenses from "./DriverExpenses";

import CustomerReturnsPortal from "./CustomerReturnsPortal";

import InsuranceClaimsPortal from "./InsuranceClaimsPortal";

import EmergencyResponseCenter from "./EmergencyResponseCenter";

import DriverCertifications from "./DriverCertifications";

import RecordMyRoute from "./RecordMyRoute";

import FollowRecordedRoute from "./FollowRecordedRoute";

import RoleManagement from "./RoleManagement";

import DemoHome from "./DemoHome";

import BusinessRegistration from "./BusinessRegistration";

import PrivacyPolicy from "./PrivacyPolicy";

import TermsOfService from "./TermsOfService";

import DataSecurity from "./DataSecurity";

import CustomerSignaturePortal from "./CustomerSignaturePortal";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    CarrierDashboard: CarrierDashboard,
    
    CustomerPortal: CustomerPortal,
    
    BusinessSenderDashboard: BusinessSenderDashboard,
    
    BinManagementPage: BinManagementPage,
    
    DriverMobile: DriverMobile,
    
    DispatchDashboard: DispatchDashboard,
    
    BatchPackageEntry: BatchPackageEntry,
    
    AnalyticsDashboard: AnalyticsDashboard,
    
    PackageManagement: PackageManagement,
    
    LabelDesigner: LabelDesigner,
    
    InventoryManagement: InventoryManagement,
    
    DriverManagement: DriverManagement,
    
    HOSManagement: HOSManagement,
    
    DOTCompliance: DOTCompliance,
    
    LoadManagement: LoadManagement,
    
    FleetMaintenance: FleetMaintenance,
    
    DriverNavigation: DriverNavigation,
    
    MailboxManagement: MailboxManagement,
    
    USPSManagement: USPSManagement,
    
    CustomerCommunication: CustomerCommunication,
    
    CustomerMessageDashboard: CustomerMessageDashboard,
    
    AdminControl: AdminControl,
    
    FleetMap: FleetMap,
    
    RoutePlanning: RoutePlanning,
    
    PaymentCenter: PaymentCenter,
    
    ReportsHub: ReportsHub,
    
    IncidentManagement: IncidentManagement,
    
    DocumentVault: DocumentVault,
    
    SystemSettings: SystemSettings,
    
    CustomerSelfService: CustomerSelfService,
    
    Home: Home,
    
    NotificationCenter: NotificationCenter,
    
    CreateShippingLabel: CreateShippingLabel,
    
    BulkOperations: BulkOperations,
    
    HelpCenter: HelpCenter,
    
    AutomationHub: AutomationHub,
    
    TrainingPortal: TrainingPortal,
    
    PublicTracking: PublicTracking,
    
    DriverExpenses: DriverExpenses,
    
    CustomerReturnsPortal: CustomerReturnsPortal,
    
    InsuranceClaimsPortal: InsuranceClaimsPortal,
    
    EmergencyResponseCenter: EmergencyResponseCenter,
    
    DriverCertifications: DriverCertifications,
    
    RecordMyRoute: RecordMyRoute,
    
    FollowRecordedRoute: FollowRecordedRoute,
    
    RoleManagement: RoleManagement,
    
    DemoHome: DemoHome,
    
    BusinessRegistration: BusinessRegistration,
    
    PrivacyPolicy: PrivacyPolicy,
    
    TermsOfService: TermsOfService,
    
    DataSecurity: DataSecurity,
    
    CustomerSignaturePortal: CustomerSignaturePortal,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<CarrierDashboard />} />
                
                
                <Route path="/CarrierDashboard" element={<CarrierDashboard />} />
                
                <Route path="/CustomerPortal" element={<CustomerPortal />} />
                
                <Route path="/BusinessSenderDashboard" element={<BusinessSenderDashboard />} />
                
                <Route path="/BinManagementPage" element={<BinManagementPage />} />
                
                <Route path="/DriverMobile" element={<DriverMobile />} />
                
                <Route path="/DispatchDashboard" element={<DispatchDashboard />} />
                
                <Route path="/BatchPackageEntry" element={<BatchPackageEntry />} />
                
                <Route path="/AnalyticsDashboard" element={<AnalyticsDashboard />} />
                
                <Route path="/PackageManagement" element={<PackageManagement />} />
                
                <Route path="/LabelDesigner" element={<LabelDesigner />} />
                
                <Route path="/InventoryManagement" element={<InventoryManagement />} />
                
                <Route path="/DriverManagement" element={<DriverManagement />} />
                
                <Route path="/HOSManagement" element={<HOSManagement />} />
                
                <Route path="/DOTCompliance" element={<DOTCompliance />} />
                
                <Route path="/LoadManagement" element={<LoadManagement />} />
                
                <Route path="/FleetMaintenance" element={<FleetMaintenance />} />
                
                <Route path="/DriverNavigation" element={<DriverNavigation />} />
                
                <Route path="/MailboxManagement" element={<MailboxManagement />} />
                
                <Route path="/USPSManagement" element={<USPSManagement />} />
                
                <Route path="/CustomerCommunication" element={<CustomerCommunication />} />
                
                <Route path="/CustomerMessageDashboard" element={<CustomerMessageDashboard />} />
                
                <Route path="/AdminControl" element={<AdminControl />} />
                
                <Route path="/FleetMap" element={<FleetMap />} />
                
                <Route path="/RoutePlanning" element={<RoutePlanning />} />
                
                <Route path="/PaymentCenter" element={<PaymentCenter />} />
                
                <Route path="/ReportsHub" element={<ReportsHub />} />
                
                <Route path="/IncidentManagement" element={<IncidentManagement />} />
                
                <Route path="/DocumentVault" element={<DocumentVault />} />
                
                <Route path="/SystemSettings" element={<SystemSettings />} />
                
                <Route path="/CustomerSelfService" element={<CustomerSelfService />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/NotificationCenter" element={<NotificationCenter />} />
                
                <Route path="/CreateShippingLabel" element={<CreateShippingLabel />} />
                
                <Route path="/BulkOperations" element={<BulkOperations />} />
                
                <Route path="/HelpCenter" element={<HelpCenter />} />
                
                <Route path="/AutomationHub" element={<AutomationHub />} />
                
                <Route path="/TrainingPortal" element={<TrainingPortal />} />
                
                <Route path="/PublicTracking" element={<PublicTracking />} />
                
                <Route path="/DriverExpenses" element={<DriverExpenses />} />
                
                <Route path="/CustomerReturnsPortal" element={<CustomerReturnsPortal />} />
                
                <Route path="/InsuranceClaimsPortal" element={<InsuranceClaimsPortal />} />
                
                <Route path="/EmergencyResponseCenter" element={<EmergencyResponseCenter />} />
                
                <Route path="/DriverCertifications" element={<DriverCertifications />} />
                
                <Route path="/RecordMyRoute" element={<RecordMyRoute />} />
                
                <Route path="/FollowRecordedRoute" element={<FollowRecordedRoute />} />
                
                <Route path="/RoleManagement" element={<RoleManagement />} />
                
                <Route path="/DemoHome" element={<DemoHome />} />
                
                <Route path="/BusinessRegistration" element={<BusinessRegistration />} />
                
                <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
                
                <Route path="/TermsOfService" element={<TermsOfService />} />
                
                <Route path="/DataSecurity" element={<DataSecurity />} />
                
                <Route path="/CustomerSignaturePortal" element={<CustomerSignaturePortal />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}